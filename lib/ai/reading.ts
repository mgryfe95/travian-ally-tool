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
  fields: z.array(z.object({ slot: n, level: z.number() })),
  buildings: z.array(z.object({ slot: n, name: z.string().nullable(), level: z.number() })),
  /** Selbstauskunft des Modells 0–1 (nur Obergrenze, die eigentliche Konfidenz kommt aus den Prüfungen) */
  selfRating: z.number(),
  /** Stellen, bei denen das Modell unsicher ist (Freitext, kurz) */
  uncertain: z.array(z.string()),
});
export type Reading = z.infer<typeof readingSchema>;
export type ReadingRow = Reading["rows"][number];

const J = (t: unknown) => t;
const nullable = (type: string) => J({ type: [type, "null"] });
const arr = (items: unknown) => J({ type: "array", items });
const obj = (props: Record<string, unknown>) => J({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });

/** Handgeschriebenes JSON-Schema (Structured Outputs: keine min/max, alle Felder required, additionalProperties=false). */
export const readingJsonSchema = obj({
  kind: { type: "string", enum: [...READING_KINDS] },
  device: { type: "string", enum: ["DESKTOP", "MOBILE", "UNKNOWN"] },
  language: { type: "string" },
  village: J({ anyOf: [obj({ name: nullable("string"), x: nullable("integer"), y: nullable("integer") }), { type: "null" }] }),
  topBar: J({ anyOf: [obj({ wood: nullable("integer"), clay: nullable("integer"), iron: nullable("integer"), crop: nullable("integer"), freeCrop: nullable("integer"), warehouse: nullable("integer"), granary: nullable("integer") }), { type: "null" }] }),
  rows: arr(obj({ name: nullable("string"), x: nullable("integer"), y: nullable("integer"), current: { type: "boolean" }, cells: arr(nullable("integer")), texts: arr(nullable("string")) })),
  totals: J({ anyOf: [obj({ cells: arr(nullable("integer")), texts: arr(nullable("string")) }), { type: "null" }] }),
  fields: arr(obj({ slot: nullable("integer"), level: { type: "integer" } })),
  buildings: arr(obj({ slot: nullable("integer"), name: nullable("string"), level: { type: "integer" } })),
  selfRating: { type: "number" },
  uncertain: arr({ type: "string" }),
}) as Record<string, unknown>;

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
