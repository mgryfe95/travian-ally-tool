import { AppError } from "./i18n/errors";
/** Eintrag je Einheit: im Dorf, unterwegs, Unterstützung (in fremden Dörfern). */
export type TroopEntry = { unit: string; inVillage: number; away: number; support: number };

export class TroopsError extends AppError {}

const MAX_ENTRIES = 60;
const MAX_COUNT = 100_000_000;

const num = (s: string | undefined, line: number, what: "InVillage" | "Away" | "Support") => {
  const t = (s ?? "").trim().replace(/\./g, "").replace(/\s/g, "");
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > MAX_COUNT) throw new TroopsError(`err.troops.badNumber${what}`, { line });
  return n;
};

/**
 * Manuelle Eingabe, eine Einheit je Zeile: `Name; im Dorf; unterwegs; Unterstützung` (Semikolon, Tab oder `|`; fehlende Zahlen = 0).
 * Leere Zeilen werden ignoriert, gleiche Einheiten summiert. Bis die Screenshot-Erkennung aktiv ist, ist das der Weg zu Truppendaten.
 */
export function parseTroopsText(text: string): TroopEntry[] {
  const map = new Map<string, TroopEntry>();
  text.replace(/\r\n?/g, "\n").split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const [name, a, b, c, extra] = line.split(/[;\t|]/);
    const unit = (name ?? "").trim();
    if (!unit || unit.length > 40) throw new TroopsError("err.troops.badName", { line: i + 1 });
    if (extra !== undefined) throw new TroopsError("err.troops.tooManyColumns", { line: i + 1 });
    const e = map.get(unit.toLowerCase()) ?? { unit, inVillage: 0, away: 0, support: 0 };
    e.inVillage += num(a, i + 1, "InVillage");
    e.away += num(b, i + 1, "Away");
    e.support += num(c, i + 1, "Support");
    map.set(unit.toLowerCase(), e);
  });
  if (map.size > MAX_ENTRIES) throw new TroopsError("err.troops.tooMany", { max: MAX_ENTRIES });
  return [...map.values()];
}

export function troopsToText(entries: TroopEntry[]): string {
  return entries.map((e) => `${e.unit}; ${e.inVillage}; ${e.away}; ${e.support}`).join("\n");
}

/** Liest gespeicherte Daten defensiv (JSON aus der DB, später auch aus der Screenshot-Pipeline). */
export function readTroops(json: unknown): TroopEntry[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((x) => {
    const o = x as Partial<TroopEntry> | null;
    if (!o || typeof o.unit !== "string") return [];
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    return [{ unit: o.unit, inVillage: n(o.inVillage), away: n(o.away), support: n(o.support) }];
  });
}

export type UnitTotal = { unit: string; inVillage: number; away: number; support: number; total: number };

/** Summe je Einheit über beliebig viele Dörfer, absteigend nach Gesamtzahl. */
export function sumTroops(lists: TroopEntry[][]): UnitTotal[] {
  const map = new Map<string, UnitTotal>();
  for (const l of lists) {
    for (const e of l) {
      const t = map.get(e.unit.toLowerCase()) ?? { unit: e.unit, inVillage: 0, away: 0, support: 0, total: 0 };
      t.inVillage += e.inVillage;
      t.away += e.away;
      t.support += e.support;
      t.total = t.inVillage + t.away;
      map.set(e.unit.toLowerCase(), t);
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.unit.localeCompare(b.unit));
}
