/**
 * Getreideverbrauch (Unterhalt pro Stunde) je Einheitenplatz 1–10 und Volk (map.sql-Volk-ID), Travian: Legends.
 * Der Help-Center-Artikel liefert diese Werte nicht verlässlich (dort nur Werte für Schmiede/Kaserne 20), daher als Konstanten.
 * Spartaner (8) und Wikinger (9) fehlen noch – bei Bedarf aus dem Spiel ergänzen. Held: 6.
 */
export const UPKEEP: Record<number, number[]> = {
  1: [1, 1, 1, 2, 3, 4, 3, 6, 5, 1], // Römer: Legionär … Senator, Siedler
  2: [1, 1, 1, 1, 2, 3, 3, 6, 4, 1], // Germanen
  3: [1, 1, 2, 2, 2, 3, 3, 6, 4, 1], // Gallier
  6: [1, 1, 1, 2, 2, 3, 3, 6, 4, 1], // Ägypter
  7: [1, 1, 2, 2, 2, 3, 3, 6, 4, 1], // Hunnen
};
export const HERO_UPKEEP = 6;

/** Unterhalt einer Einheit: Platz 1–10 (aus „Einheit N“ oder Namensliste), „Held“ = 6; unbekannt = null. */
export function upkeepOf(tribe: number | null | undefined, unit: string, slotByName: Map<string, number>): number | null {
  if (/^(held|hero)$/i.test(unit.trim())) return HERO_UPKEEP;
  const m = /^Einheit (\d+)$/.exec(unit);
  const slot = m ? Number(m[1]) : slotByName.get(unit.trim().toLowerCase());
  if (!slot || tribe == null) return null;
  return UPKEEP[tribe]?.[slot - 1] ?? null;
}

/** Summe Getreide/h für eine Truppenliste; `unknown` zählt Einheiten ohne bekannten Unterhalt. */
export function troopUpkeep(tribe: number | null | undefined, units: { unit: string; count: number }[], slotByName: Map<string, number>): { total: number; unknown: number } {
  let total = 0, unknown = 0;
  for (const u of units) {
    const k = upkeepOf(tribe, u.unit, slotByName);
    if (k === null) unknown += u.count;
    else total += k * u.count;
  }
  return { total, unknown };
}
