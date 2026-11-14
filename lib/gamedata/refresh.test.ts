import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { diffBuildings, refreshGameData } from "./refresh";

describe("Spieldaten-Abgleich", () => {
  it("diffBuildings: geändert, neu, entfallen", () => {
    const a = [{ key: "a", maxLevel: 2, levels: [1] }, { key: "b", maxLevel: 2, levels: [1] }];
    const b = [{ key: "a", maxLevel: 2, levels: [2] }, { key: "c", maxLevel: 1, levels: [1] }];
    expect(diffBuildings(a, b)).toEqual({ changed: ["a"], added: ["c"], removed: ["b"] });
  });
  it("hält robots.txt ein und importiert nie: Bericht als Setting", async () => {
    const saved: string[] = [];
    const db = { setting: { upsert: vi.fn(async (q: { create: { value: string } }) => void saved.push(q.create.value)), findUnique: vi.fn(async () => null) } };
    const fetchFn = vi.fn(async (url: string) => ({ ok: true, status: 200, text: async () => (url.endsWith("robots.txt") ? "User-agent: *\nDisallow: /" : "") }));
    const r = await refreshGameData(db as never, fetchFn, new Date("2027-01-01T04:15:00Z"), await mkdtemp(path.join(os.tmpdir(), "gd-")));
    expect(r.status).toBe("blocked");
    expect(fetchFn).toHaveBeenCalledTimes(1); // nur robots.txt
    expect(JSON.parse(saved[0]!)).toMatchObject({ status: "blocked" });
  });
  it("neue main.js → Bericht „changed“ mit Gebäudeliste und gespeicherter Datei; gleiche Datei → „unchanged“", async () => {
    const lvl = (n: number) => `${n}:{level:${n},resourceCost:{r1:${n * 10},r2:1,r3:1,r4:1},buildingTime:1000,culturePoints:1,population:1,supply:1}`;
    const bld = (gid: number) => `{gid:${gid},maxLevel:1,category:"Infrastructure",prerequisites:[],levelData:{${lvl(1)}}}`;
    const js = `const Y=[${Array.from({ length: 10 }, (_, i) => bld(i + 1)).join(",")}];const Z={},_={${[...Array(10)].map((_, i) => `${i + 1}:{"en-US":"Thing ${i + 1}","de-DE":"Ding ${i + 1}"}`).join(",")}},$={tribe_vid1:{"en-US":"Romans","de-DE":"Römer"}};`;
    let stored: string | null = null;
    const db = { setting: { upsert: vi.fn(async (q: { create: { value: string } }) => void (stored = q.create.value)), findUnique: vi.fn(async () => (stored ? { value: stored } : null)) } };
    const fetchFn = vi.fn(async (url: string) => ({ ok: true, status: 200, text: async () => (url.endsWith("robots.txt") ? "" : url.endsWith(".js") ? js : `<html><script src="/assets/main.1a2b.js"></script></html>`) }));
    const dir = await mkdtemp(path.join(os.tmpdir(), "gd-"));
    const r = await refreshGameData(db as never, fetchFn, new Date("2027-01-01T04:15:00Z"), dir);
    expect(r).toMatchObject({ status: "changed", url: "https://knowledgebase.legends.travian.com/assets/main.1a2b.js" });
    expect(r.added).toHaveLength(10);
    expect(r.file).toMatch(/kb-[0-9a-f]{16}\.js$/);
    expect((await refreshGameData(db as never, fetchFn, new Date("2027-07-01T04:15:00Z"), dir)).status).toBe("unchanged");
  });
});
