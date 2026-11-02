import type { WorldProfile } from "../world-profile";
import { AppError } from "../i18n/errors";

/**
 * Liest die Legends-Wissensdatenbank (`main.js` der Seite, Datenteil) und wandelt sie in das Spieldaten-Importformat.
 * Die Datei ist nur Daten-Lieferant und wird NIE ausgeführt: ein eigener, strikter Parser liest nur Objekt-/Array-/String-/Zahl-Literale
 * und bricht bei allem anderen (Funktionen, Aufrufe, Variablen) ab.
 */
export class KbError extends AppError {}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const ws = (s: string, i: number) => {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  return i;
};

/** Parst ein JS-Literal ab `i`; liefert [Wert, Position danach]. */
export function parseLiteral(s: string, start: number, depth = 0): [Json, number] {
  if (depth > 40) throw new KbError("err.kb.tooDeep");
  let i = ws(s, start);
  const c = s[i];
  if (c === "{") {
    const obj: { [k: string]: Json } = {};
    i = ws(s, i + 1);
    while (s[i] !== "}") {
      let key: string;
      if (s[i] === '"' || s[i] === "'") [key, i] = readString(s, i);
      else {
        const m = /^[A-Za-z0-9_$]+/.exec(s.slice(i, i + 80));
        if (!m) throw new KbError("err.kb.keyExpected", { i, ctx: s.slice(i, i + 30) });
        key = m[0];
        i += key.length;
      }
      i = ws(s, i);
      if (s[i] !== ":") throw new KbError("err.kb.colonExpected", { i });
      let v: Json;
      [v, i] = parseLiteral(s, i + 1, depth + 1);
      obj[key] = v;
      i = ws(s, i);
      if (s[i] === ",") i = ws(s, i + 1);
      else if (s[i] !== "}") throw new KbError("err.kb.commaOrBrace", { i });
    }
    return [obj, i + 1];
  }
  if (c === "[") {
    const arr: Json[] = [];
    i = ws(s, i + 1);
    while (s[i] !== "]") {
      let v: Json;
      [v, i] = parseLiteral(s, i, depth + 1);
      arr.push(v);
      i = ws(s, i);
      if (s[i] === ",") i = ws(s, i + 1);
      else if (s[i] !== "]") throw new KbError("err.kb.commaOrBracket", { i });
    }
    return [arr, i + 1];
  }
  if (c === '"' || c === "'") return readString(s, i);
  const num = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i, i + 40));
  if (num) return [Number(num[0]), i + num[0].length];
  for (const [lit, val] of [["!0", true], ["!1", false], ["true", true], ["false", false], ["null", null]] as const) if (s.startsWith(lit, i)) return [val, i + lit.length];
  throw new KbError("err.kb.noLiteral", { i, ctx: s.slice(i, i + 30) });
}

function readString(s: string, i: number): [string, number] {
  const q = s[i]!;
  let out = "";
  i++;
  while (i < s.length && s[i] !== q) {
    if (s[i] === "\\") {
      const n = s[i + 1]!;
      if (n === "u") { out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)); i += 6; continue; }
      out += n === "n" ? "\n" : n === "t" ? "\t" : n;
      i += 2;
    } else out += s[i++];
  }
  if (s[i] !== q) throw new KbError("err.kb.unterminated");
  return [out, i + 1];
}

const decode = (t: string) => t.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

export type KbLevel = { level: number; resourceCost: { r1: number; r2: number; r3: number; r4: number }; buildingTime: number; culturePoints: number; population: number; supply: number; effects?: Record<string, number> };
export type KbBuilding = { gid: number; maxLevel: number; category: string; prerequisites: Json[]; levelData: Record<string, KbLevel> };
export type Kb = { buildings: KbBuilding[]; names: Record<number, { en: string; de: string }>; tribes: Record<number, { en: string; de: string }> };

const lang = (o: Json, code: string, fallback?: string) => {
  const v = (o as Record<string, Json>)?.[code] ?? (fallback ? (o as Record<string, Json>)?.[fallback] : undefined);
  return typeof v === "string" ? decode(v) : undefined;
};

export function parseKnowledgeBase(js: string): Kb {
  const a = js.indexOf("=[{gid:");
  if (a < 0) throw new KbError("err.kb.noBuildingData");
  const [arr] = parseLiteral(js, a + 1);
  const buildings = (arr as unknown as KbBuilding[]).filter((b) => b && typeof b.gid === "number" && b.levelData);
  if (buildings.length < 10) throw new KbError("err.kb.fewBuildings", { n: buildings.length });

  const n = js.indexOf("={1:{");
  if (n < 0) throw new KbError("err.kb.noNames");
  const [dict] = parseLiteral(js, n + 1);
  const names: Kb["names"] = {};
  for (const [k, v] of Object.entries(dict as Record<string, Json>)) {
    const en = lang(v, "en-US", "com");
    if (en) names[Number(k)] = { en, de: lang(v, "de-DE") ?? en };
  }
  const tribes: Kb["tribes"] = {};
  for (const m of js.matchAll(/tribe_vid(\d+):\{/g)) {
    const [v] = parseLiteral(js, m.index! + m[0].length - 1);
    const en = lang(v, "en-US", "com");
    if (en) tribes[Number(m[1])] = { en, de: lang(v, "de-DE") ?? en };
  }
  return { buildings, names, tribes };
}

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/**
 * Wandelt die Daten in das Importformat. Die Quelle nennt Basiswerte für Server-Speed 1 und Hauptgebäude Stufe 1; die Seite selbst rechnet
 * Bauzeiten als `10·round(t·f/10)` mit f = Hauptgebäude-Faktor / Speed. Hier wird auf die Geschwindigkeit der EIGENEN Welt umgerechnet
 * (genau die Formel der Quelle, Hauptgebäude-Faktor 1); der Hauptgebäude-Einfluss kommt erst bei der Anzeige je Dorf.
 */
export function kbToGameData(kb: Kb, world: WorldProfile, source: string) {
  if (world.speed === null) throw new KbError("err.kb.speedUnknown");
  const speed = world.speed;
  const tribeKey = (id: number) => (kb.tribes[id] ? slug(kb.tribes[id]!.en) : `tribe_${id}`);
  const used = new Set<number>();
  const buildings = kb.buildings
    .sort((x, y) => x.gid - y.gid)
    .map((b) => {
      const name = kb.names[b.gid];
      if (!name) throw new KbError("err.kb.noName", { gid: b.gid });
      const tribeReq = b.prerequisites.find((p) => (p as { type?: string }).type === "Tribe") as { vid: number[] } | undefined;
      tribeReq?.vid.forEach((v) => used.add(v));
      const levels = Object.values(b.levelData)
        .sort((x, y) => x.level - y.level)
        .map((l) => ({
          level: l.level, costWood: l.resourceCost.r1, costClay: l.resourceCost.r2, costIron: l.resourceCost.r3, costCrop: l.resourceCost.r4,
          upkeep: l.supply, buildTimeSec: 10 * Math.round((l.buildingTime / speed) / 10), culturePoints: l.culturePoints, effects: { ...(l.effects ?? {}), population: l.population },
        }));
      return {
        key: slug(name.en), gid: b.gid, name: name.de, nameEn: name.en, category: b.category.toLowerCase(), tribeRestriction: tribeReq && tribeReq.vid.length === 1 ? tribeKey(tribeReq.vid[0]!) : null,
        maxLevel: b.maxLevel, prerequisites: b.prerequisites, description: `EN: ${name.en}`, levels,
      };
    });
  const tribeIds = Object.keys(kb.tribes).map(Number).sort((a, b) => a - b);
  return {
    source, world: { host: world.host, gameVersion: world.version }, serverSpeed: speed,
    notes: "Gebäude aus der Legends-Wissensdatenbank (Basiswerte, Bauzeit für Hauptgebäude Stufe 1 und Server-Speed der Welt). Völker-IDs wie in map.sql.",
    tribes: tribeIds.map((id) => ({ key: tribeKey(id), name: kb.tribes[id]!.de, traits: { vid: id, en: kb.tribes[id]!.en } })),
    buildings, units: [],
  };
}
