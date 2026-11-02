import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { env } from "../env";
import { worldProfile } from "../world-profile";
import { kbToGameData, parseKnowledgeBase } from "./kb";
import { allowedByRobots, analyzeHtml } from "./probe";

/**
 * Halbjährlicher Abgleich der Spieldaten mit der Legends-Wissensdatenbank (Worker, `GAMEDATA_REFRESH_CRON`, standardmäßig aus).
 * Höflich (robots.txt, Kennung, 2 Abrufe) und ohne automatisches Überschreiben: Ergebnis ist ein Diff-Bericht (Setting `gamedata:refresh`);
 * übernommen wird erst von Hand mit `npx tsx scripts/import-kb.ts <gespeicherte main.js>`.
 */
export const REFRESH_KEY = "gamedata:refresh";
export const KB_START = "https://knowledgebase.legends.travian.com/en-US/buildings";
const UA = "ally-tool-gamedata/1.0 (privates Allianz-Tool; halbjährlicher Abgleich)";

export type RefreshReport = {
  at: string; status: "unchanged" | "changed" | "blocked" | "failed"; url?: string; hash?: string; file?: string;
  changed?: string[]; added?: string[]; removed?: string[]; error?: string;
};

type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
type Bld = { key: string; levels: unknown[]; maxLevel: number };

/** Unterschiede je Gebäude (Schlüssel): geänderte Stufenwerte, neue und entfallene Gebäude. */
export function diffBuildings(prev: Bld[], next: Bld[]) {
  const p = new Map(prev.map((b) => [b.key, JSON.stringify([b.maxLevel, b.levels])]));
  const n = new Map(next.map((b) => [b.key, JSON.stringify([b.maxLevel, b.levels])]));
  return {
    changed: [...n].filter(([k, v]) => p.has(k) && p.get(k) !== v).map(([k]) => k),
    added: [...n.keys()].filter((k) => !p.has(k)),
    removed: [...p.keys()].filter((k) => !n.has(k)),
  };
}

export async function refreshGameData(db: PrismaClient, fetchFn: Fetch = fetch as unknown as Fetch, now = new Date(), dir = path.join(env().STORAGE_DIR, "gamedata")): Promise<RefreshReport> {
  const save = async (r: RefreshReport) => {
    await db.setting.upsert({ where: { key: REFRESH_KEY }, create: { key: REFRESH_KEY, value: JSON.stringify(r) }, update: { value: JSON.stringify(r) } });
    return r;
  };
  const at = now.toISOString();
  try {
    const world = worldProfile(env().TRAVIAN_SERVER_URL, { version: env().GAME_VERSION, speed: env().GAME_SPEED });
    if (world.version !== "legends") return save({ at, status: "failed", error: `world version ${world.version} – only legends` });
    const origin = new URL(KB_START).origin;
    const robots = await fetchFn(`${origin}/robots.txt`, { headers: { "user-agent": UA } }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    if (!allowedByRobots(robots, new URL(KB_START).pathname)) return save({ at, status: "blocked", error: "robots.txt" });
    const page = await fetchFn(KB_START, { headers: { "user-agent": UA } });
    if (!page.ok) return save({ at, status: "failed", error: `HTTP ${page.status}` });
    const url = analyzeHtml(await page.text(), KB_START).scripts.find((s) => /\/main[.\w-]*\.js(\?|$)/.test(s));
    if (!url || !allowedByRobots(robots, new URL(url).pathname)) return save({ at, status: url ? "blocked" : "failed", url, error: url ? "robots.txt" : "main.js not found" });
    const res = await fetchFn(url, { headers: { "user-agent": UA } });
    if (!res.ok) return save({ at, status: "failed", url, error: `HTTP ${res.status}` });
    const js = await res.text();
    const hash = createHash("sha256").update(js).digest("hex").slice(0, 16);
    const last = await db.setting.findUnique({ where: { key: REFRESH_KEY } });
    const prevReport = last ? (JSON.parse(last.value) as RefreshReport) : null;
    if (prevReport?.hash === hash) return save({ ...prevReport, at, status: "unchanged" });
    const data = kbToGameData(parseKnowledgeBase(js), world, `${url} (abgerufen ${at.slice(0, 10)}, sha256 ${hash})`);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `kb-${hash}.js`);
    await writeFile(file, js);
    const prev = await readFile(path.join(dir, "kb-latest.json"), "utf8").then((s) => JSON.parse(s) as { buildings: Bld[] }).catch(() => ({ buildings: [] as Bld[] }));
    await writeFile(path.join(dir, "kb-latest.json"), JSON.stringify(data));
    return save({ at, status: "changed", url, hash, file, ...diffBuildings(prev.buildings, data.buildings) });
  } catch (e) {
    return save({ at, status: "failed", error: (e as Error).message.slice(0, 300) });
  }
}

export async function lastRefresh(db: PrismaClient): Promise<RefreshReport | null> {
  const s = await db.setting.findUnique({ where: { key: REFRESH_KEY } });
  try {
    return s ? (JSON.parse(s.value) as RefreshReport) : null;
  } catch {
    return null;
  }
}
