import type { Reading } from "./ai/reading";

export const INCIDENT_KINDS = ["attack", "raid", "scout", "unknown"] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];
export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const;
export type Answers = { moreAttacks: (typeof YES_NO_UNKNOWN)[number]; ongoing: "yes" | "no"; needHelp: "yes" | "no" };
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
