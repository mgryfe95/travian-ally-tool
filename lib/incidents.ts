import type { Reading } from "./ai/reading";

export const INCIDENT_KINDS = ["attack", "raid", "scout", "unknown"] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];
export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const;
/** `siege`: hatte der letzte Angriff Rammen/Katapulte oder Senatoren/Häuptlinge? (ältere Incidents ohne Angabe) */
export type Answers = { moreAttacks: (typeof YES_NO_UNKNOWN)[number]; ongoing: "yes" | "no"; needHelp: "yes" | "no"; siege?: (typeof YES_NO_UNKNOWN)[number] };
export type UnitCount = { unit: string; count: number };

export type IncidentDraft = {
  kind: IncidentKind;
  attackerName: string; attackerVillage: string; attackerAlliance: string;
  attackerX: number | null; attackerY: number | null;
  defenderX: number | null; defenderY: number | null;
  occurredText: string;
  /** Spalten wie im Bericht (Platz 1–10, 11 = Held) */
  attackerUnits: number[]; attackerLosses: number[]; defenderLosses: number[];
};

const cells = (r: Reading, name: string) => (r.rows.find((x) => x.name === name)?.cells ?? []).map((c) => (typeof c === "number" && c > 0 ? c : 0));
const text = (v: string | null | undefined) => (v ?? "").trim();

/** Lesung eines Kampfberichts → Entwurf für das Incident-Formular (der Nutzer prüft und ergänzt). */
export function draftFromReading(r: Reading): IncidentDraft | null {
  if (r.kind !== "BATTLE_REPORT") return null;
  const info = r.rows.find((x) => x.name === "info");
  const t = info?.texts ?? [];
  const att = r.rows.find((x) => x.name === "attacker_units");
  const def = r.rows.find((x) => x.name === "defender_units");
  const k = text(t[6]).toLowerCase();
  return {
    kind: (["attack", "raid", "scout"] as const).find((x) => x === k) ?? "unknown",
    attackerName: text(t[0]), attackerVillage: text(t[1]), attackerAlliance: text(t[2]),
    attackerX: att?.x ?? null, attackerY: att?.y ?? null,
    defenderX: def?.x ?? null, defenderY: def?.y ?? null,
    occurredText: text(t[5]),
    attackerUnits: cells(r, "attacker_units"), attackerLosses: cells(r, "attacker_losses"), defenderLosses: cells(r, "defender_losses"),
  };
}

/** Spalten → benannte Einheiten (Platz i+1; Spalte 11 = Held); Nullen fallen weg. */
export function namedUnits(counts: number[], nameOf: (slot: number) => string): UnitCount[] {
  return counts.flatMap((c, i) => (c > 0 ? [{ unit: i === 10 ? nameOf(11) : nameOf(i + 1), count: c }] : []));
}

/** Zeilen „Einheit; Anzahl“ (manuelle Eingabe der Verluste). */
export function parseUnitLines(s: string): UnitCount[] {
  return s.replace(/\r\n?/g, "\n").split("\n").flatMap((line) => {
    const [u, n] = line.split(/[;\t|]/);
    const unit = (u ?? "").trim();
    const count = Number((n ?? "").trim().replace(/\./g, ""));
    return unit && unit.length <= 40 && Number.isInteger(count) && count > 0 && count < 100_000_000 ? [{ unit, count }] : [];
  }).slice(0, 20);
}

/** "x|y" oder "(x|y)" → Koordinaten. */
export function parseCoordText(s: string): { x: number; y: number } | null {
  const m = /\(?\s*([-−]?\d{1,3})\s*\|\s*([-−]?\d{1,3})\s*\)?/.exec(s);
  if (!m) return null;
  const x = Number(m[1]!.replace("−", "-")), y = Number(m[2]!.replace("−", "-"));
  return Math.abs(x) <= 200 && Math.abs(y) <= 200 ? { x, y } : null;
}

/** Bedrohungsmodus: 3 Tage, 1 Tag wenn keine weiteren Angriffe erwartet werden. */
export const threatDays = (a: Answers) => (a.moreAttacks === "no" ? 1 : 3);

/** Rammen, Katapulte, Senatoren/Häuptlinge = Plätze 7–9 bei allen Völkern. */
export const hasSiege = (units: number[]) => [6, 7, 8].some((i) => (units[i] ?? 0) > 0);

/** System-Call „Angriff melden“: weitere Angriffe erwartet und (gerade laufende Angriffe oder Belagerung/Eroberung im letzten Angriff). */
export const alertWorthy = (a: Answers) => a.moreAttacks === "yes" && (a.ongoing === "yes" || a.siege === "yes");

// ───────── Incident-Typen und Parameter (Klärung per Chat) ─────────

export type ParamType = "text" | "coord" | "yn" | "ynu";
export type ParamSpec = { key: string; type: ParamType; required: boolean };

/** Typen und ihre Parameter. Reihenfolge der Parameter = Reihenfolge der Fragen. */
export const INCIDENT_TYPES = {
  defense: [
    { key: "attacker", type: "text", required: true },
    { key: "moreAttacks", type: "ynu", required: true },
    { key: "ongoing", type: "yn", required: true },
    { key: "siege", type: "ynu", required: true },
    { key: "needHelp", type: "yn", required: true },
  ],
  scouted: [
    { key: "attacker", type: "text", required: true },
    { key: "moreAttacks", type: "ynu", required: true },
  ],
  offense: [
    { key: "target", type: "text", required: true },
    { key: "result", type: "text", required: true },
    { key: "losses", type: "text", required: false },
  ],
  village_lost: [
    { key: "attacker", type: "text", required: true },
    { key: "needHelp", type: "yn", required: true },
  ],
  oasis: [
    { key: "oasis", type: "coord", required: true },
    { key: "attacker", type: "text", required: false },
  ],
  diplomacy: [
    { key: "otherAlliance", type: "text", required: true },
    { key: "what", type: "text", required: true },
  ],
  other: [],
} as const satisfies Record<string, readonly ParamSpec[]>;

export type IncidentType = keyof typeof INCIDENT_TYPES;
export const INCIDENT_TYPE_KEYS = Object.keys(INCIDENT_TYPES) as IncidentType[];
export const isIncidentType = (s: string): s is IncidentType => s in INCIDENT_TYPES;
export const paramSpecs = (type: string): readonly ParamSpec[] => (isIncidentType(type) ? INCIDENT_TYPES[type] : []);

export type Params = Record<string, string>;

const YES = /^(y|yes|ja|j|oui|o|true|1|si|da)\b/i;
const NO = /^(n|no|nein|non|false|0|nope)\b/i;
const UNKNOWN = /^(\?|unknown|unbekannt|weiß nicht|weiss nicht|keine ahnung|je ne sais pas|inconnu|vielleicht|maybe|peut-être)/i;

/** Normalisiert einen Parameterwert; null = nicht verwertbar. */
export function normalizeParam(spec: ParamSpec, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  switch (spec.type) {
    case "yn":
    case "ynu": {
      if (YES.test(s)) return "yes";
      if (NO.test(s)) return "no";
      if (spec.type === "ynu" && UNKNOWN.test(s)) return "unknown";
      return null;
    }
    case "coord": {
      const c = parseCoordText(s);
      return c ? `${c.x}|${c.y}` : null;
    }
    default:
      return s.slice(0, 200);
  }
}

/** Übernimmt gültige Werte (nur bekannte Schlüssel des Typs) in `params`. */
export function mergeParams(type: string, params: Params, incoming: Record<string, unknown>): Params {
  const out = { ...params };
  for (const spec of paramSpecs(type)) {
    if (!(spec.key in incoming)) continue;
    const v = normalizeParam(spec, incoming[spec.key]);
    if (v !== null) out[spec.key] = v;
  }
  return out;
}

export const missingParams = (type: string, params: Params) => paramSpecs(type).filter((p) => p.required && !params[p.key]);

/** Parameter → Antworten des Bedrohungsmodus (für Lagebild, Alarm, Bedrohungsdauer). */
export function answersFromParams(type: string, p: Params): Answers {
  const ynu = (v: string | undefined) => (v === "yes" || v === "no" ? v : "unknown") as Answers["moreAttacks"];
  return {
    moreAttacks: type === "defense" || type === "scouted" ? ynu(p.moreAttacks) : "no",
    ongoing: p.ongoing === "yes" ? "yes" : "no",
    needHelp: p.needHelp === "yes" ? "yes" : "no",
    siege: type === "defense" ? ynu(p.siege) : "unknown",
  };
}

/** Kampfbericht-Art → Incident-Typ */
export const typeFromKind = (kind: string): IncidentType => (kind === "scout" ? "scouted" : "defense");
