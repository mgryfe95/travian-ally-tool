import { z } from "zod";

/**
 * Was die Bilderkennung aus einem Screenshot liefert (ein einheitliches Format für alle Arten, damit Prompt, Schema,
 * Prüfungen und Lern-Beispiele überall gleich funktionieren). Zahlen stehen spaltenweise in `cells`, Zeiten/Brüche in `texts`.
 */
export const READING_KINDS = [
  "RALLY_POINT", // Versammlungsplatz: Truppen im Dorf
  "VILLAGE_TROOPS", // Dorfstatistik › Truppen (je Dorf + Summenzeile)
  "VILLAGE_TROOPS_PRESENT", // Dorfstatistik › Truppen in Dörfern (Desktop: alle Truppen im Dorf je Volk-Zeile + Unterhalt/Kampfwerte)
  "VILLAGE_TRAINING", // Dorfstatistik › Ausbildung (Restzeiten je Kasernen-Typ)
  "VILLAGE_SMITHY", // Dorfstatistik › Schmiede (Stufen je Einheit)
  "VILLAGE_HOSPITAL", // Dorfstatistik › Hospital (Verwundete)
  "VILLAGE_CULTURE", // Dorfstatistik › Kulturpunkte
  "VILLAGE_RESOURCES", // Dorfstatistik › Rohstoffe (Bestände, Händler; mobil zusätzlich Produktion/Restzeiten)
  "VILLAGE_PRODUCTION", // Dorfstatistik › Produktion (Desktop: Brutto je Rohstoff)
  "RESOURCE_VIEW", // Rohstofffelder-Ansicht (18 Felder mit Stufen)
  "VILLAGE_VIEW", // Dorfzentrum-Ansicht (Gebäude mit Stufen)
  "BATTLE_REPORT", // Kampfbericht
  "UNKNOWN",
] as const;
export type ReadingKind = (typeof READING_KINDS)[number];

const n = z.number().nullable();
const topBar = z.object({ wood: n, clay: n, iron: n, crop: n, freeCrop: n, warehouse: n, granary: n });
const row = z.object({
  /** Dorfname bzw. Rolle (nur Kampfbericht: attacker_units, attacker_losses, defender_units, defender_losses, …) */
  name: z.string().nullable(),
  x: n,
  y: n,
  current: z.boolean(),
  cells: z.array(n),
  texts: z.array(z.string().nullable()),
});

export const readingSchema = z.object({
  kind: z.enum(READING_KINDS),
  device: z.enum(["DESKTOP", "MOBILE", "UNKNOWN"]),
  language: z.string(),
  village: z.object({ name: z.string().nullable(), x: n, y: n }).nullable(),
  topBar: topBar.nullable(),
  rows: z.array(row),
  totals: z.object({ cells: z.array(n), texts: z.array(z.string().nullable()) }).nullable(),
  /** x/y = Mittelpunkt der Marke im Bild, relativ 0–1 (links/oben = 0); fehlt bei älteren Lesungen */
  /** type = wood | clay | iron | crop (fehlt bei älteren Lesungen) */
  fields: z.array(z.object({ slot: n, level: z.number(), type: z.enum(["wood", "clay", "iron", "crop"]).nullable().optional(), x: n.optional(), y: n.optional() })),
  buildings: z.array(z.object({ slot: n, name: z.string().nullable(), level: z.number(), x: n.optional(), y: n.optional() })),
  /** Selbstauskunft des Modells 0–1 (nur Obergrenze, die eigentliche Konfidenz kommt aus den Prüfungen) */
  selfRating: z.number(),
  /** Stellen, bei denen das Modell unsicher ist (Freitext, kurz) */
  uncertain: z.array(z.string()),
});
export type Reading = z.infer<typeof readingSchema>;
export type ReadingRow = Reading["rows"][number];

// ───────── Wire-Format zur API ─────────
// Structured Outputs erlauben höchstens 16 Parameter mit Union-Typen (type-Arrays/anyOf). Deshalb enthält das API-Schema keine
// Unions: Zahlen mit „unbekannt“ sind Strings ("" oder "-" = unbekannt), Koordinaten "x|y" bzw. "", Objekte sind immer vorhanden.

export const apiSchema = z.object({
  kind: z.enum(READING_KINDS),
  device: z.enum(["DESKTOP", "MOBILE", "UNKNOWN"]),
  language: z.string(),
  village: z.object({ name: z.string(), coord: z.string() }),
  topBar: z.object({ present: z.boolean(), wood: z.string(), clay: z.string(), iron: z.string(), crop: z.string(), freeCrop: z.string(), warehouse: z.string(), granary: z.string() }),
  rows: z.array(z.object({ name: z.string(), coord: z.string(), current: z.boolean(), cells: z.array(z.string()), texts: z.array(z.string()) })),
  totals: z.object({ present: z.boolean(), cells: z.array(z.string()), texts: z.array(z.string()) }),
  fields: z.array(z.object({ slot: z.number(), level: z.number(), type: z.string(), x: z.number(), y: z.number() })),
  buildings: z.array(z.object({ slot: z.number(), name: z.string(), level: z.number(), x: z.number(), y: z.number() })),
  selfRating: z.number(),
  uncertain: z.array(z.string()),
});
export type ApiReading = z.infer<typeof apiSchema>;

const str = { type: "string" } as const;
const int = { type: "integer" } as const;
const arrOf = (items: unknown) => ({ type: "array", items });
const obj = (props: Record<string, unknown>) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });

export const readingJsonSchema = obj({
  kind: { type: "string", enum: [...READING_KINDS] },
  device: { type: "string", enum: ["DESKTOP", "MOBILE", "UNKNOWN"] },
  language: str,
  village: obj({ name: str, coord: str }),
  topBar: obj({ present: { type: "boolean" }, wood: str, clay: str, iron: str, crop: str, freeCrop: str, warehouse: str, granary: str }),
  rows: arrOf(obj({ name: str, coord: str, current: { type: "boolean" }, cells: arrOf(str), texts: arrOf(str) })),
  totals: obj({ present: { type: "boolean" }, cells: arrOf(str), texts: arrOf(str) }),
  fields: arrOf(obj({ slot: int, level: int, type: { type: "string", enum: ["wood", "clay", "iron", "crop", ""] }, x: { type: "number" }, y: { type: "number" } })),
  buildings: arrOf(obj({ slot: int, name: str, level: int, x: { type: "number" }, y: { type: "number" } })),
  selfRating: { type: "number" },
  uncertain: arrOf(str),
}) as Record<string, unknown>;

/** "13,956" / "13.956" / "−2334" / "+1,695" → Zahl; "", "-" → null. */
export function parseNum(raw: string): number | null {
  const t = raw.trim().replace(/[−–]/g, "-").replace(/^\+/, "");
  if (t === "" || t === "-") return null;
  const n = Number(t.replace(/[.,\s](?=\d{3}(\D|$))/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "x|y", "(-3|-82)", "−3|−82" → [x, y] oder null. */
export function parseCoordStr(raw: string): [number, number] | null {
  const m = raw.trim().replace(/[()−–]/g, (c) => (c === "(" || c === ")" ? "" : "-")).match(/^(-?\d{1,4})\s*[|,; ]\s*(-?\d{1,4})$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export const RES_TYPES = ["wood", "clay", "iron", "crop"] as const;
export type ResType = (typeof RES_TYPES)[number];

/** Relative Bildposition 0–1; alles andere (z. B. -1) = unbekannt. */
const rel = (v: number): number | null => (Number.isFinite(v) && v >= 0 && v <= 1 ? Math.round(v * 1000) / 1000 : null);

export function apiToReading(a: ApiReading): Reading {
  const xy = (c: string) => parseCoordStr(c);
  const vc = xy(a.village.coord);
  return {
    kind: a.kind, device: a.device, language: a.language,
    village: a.village.name.trim() || vc ? { name: a.village.name.trim() || null, x: vc?.[0] ?? null, y: vc?.[1] ?? null } : null,
    topBar: a.topBar.present
      ? { wood: parseNum(a.topBar.wood), clay: parseNum(a.topBar.clay), iron: parseNum(a.topBar.iron), crop: parseNum(a.topBar.crop), freeCrop: parseNum(a.topBar.freeCrop), warehouse: parseNum(a.topBar.warehouse), granary: parseNum(a.topBar.granary) }
      : null,
    rows: a.rows.map((r) => { const c = xy(r.coord); return { name: r.name.trim() || null, x: c?.[0] ?? null, y: c?.[1] ?? null, current: r.current, cells: r.cells.map(parseNum), texts: r.texts.map((t) => (t.trim() === "" ? null : t)) }; }),
    totals: a.totals.present ? { cells: a.totals.cells.map(parseNum), texts: a.totals.texts.map((t) => (t.trim() === "" ? null : t)) } : null,
    fields: a.fields.map((f) => ({ slot: f.slot > 0 ? f.slot : null, level: f.level, type: RES_TYPES.includes(f.type as ResType) ? (f.type as ResType) : null, x: rel(f.x), y: rel(f.y) })),
    buildings: a.buildings.map((b) => ({ slot: b.slot > 0 ? b.slot : null, name: b.name.trim() || null, level: b.level, x: rel(b.x), y: rel(b.y) })),
    selfRating: a.selfRating, uncertain: a.uncertain,
  };
}

const ns = (n: number | null) => (n === null ? "" : String(n));
const cs = (x: number | null, y: number | null) => (x === null || y === null ? "" : `${x}|${y}`);

/** Umkehrung für Few-Shot-Beispiele (Gold-Lesung → so, wie das Modell antworten soll). */
export function readingToApi(r: Reading): ApiReading {
  return {
    kind: r.kind, device: r.device, language: r.language,
    village: { name: r.village?.name ?? "", coord: cs(r.village?.x ?? null, r.village?.y ?? null) },
    topBar: { present: !!r.topBar, wood: ns(r.topBar?.wood ?? null), clay: ns(r.topBar?.clay ?? null), iron: ns(r.topBar?.iron ?? null), crop: ns(r.topBar?.crop ?? null), freeCrop: ns(r.topBar?.freeCrop ?? null), warehouse: ns(r.topBar?.warehouse ?? null), granary: ns(r.topBar?.granary ?? null) },
    rows: r.rows.map((x) => ({ name: x.name ?? "", coord: cs(x.x, x.y), current: x.current, cells: x.cells.map((c) => (c === null ? "-" : String(c))), texts: x.texts.map((t) => t ?? "") })),
    totals: { present: !!r.totals, cells: (r.totals?.cells ?? []).map((c) => (c === null ? "-" : String(c))), texts: (r.totals?.texts ?? []).map((t) => t ?? "") },
    fields: r.fields.map((f) => ({ slot: f.slot ?? 0, level: f.level, type: f.type ?? "", x: f.x ?? -1, y: f.y ?? -1 })),
    buildings: r.buildings.map((b) => ({ slot: b.slot ?? 0, name: b.name ?? "", level: b.level, x: b.x ?? -1, y: b.y ?? -1 })),
    selfRating: r.selfRating, uncertain: r.uncertain,
  };
}

/** Spaltenzahl je Art (Zeilen mit anderer Länge sind verdächtig). null = frei. */
export const EXPECTED_CELLS: Partial<Record<ReadingKind, number[]>> = {
  RALLY_POINT: [10, 11],
  VILLAGE_TROOPS: [10, 11],
  VILLAGE_TROOPS_PRESENT: [10, 11],
  VILLAGE_SMITHY: [8],
  VILLAGE_HOSPITAL: [6, 10],
  VILLAGE_RESOURCES: [4, 8],
  VILLAGE_PRODUCTION: [4],
  VILLAGE_CULTURE: [1],
};
