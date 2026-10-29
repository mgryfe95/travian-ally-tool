export type MapRow = {
  fieldId: number;
  x: number;
  y: number;
  tribe: number;
  villageId: number;
  villageName: string;
  playerId: number;
  playerName: string;
  allianceId: number;
  allianceName: string;
  population: number;
  /** Alle Spalten ab Index 11. Bekannte Namen siehe EXTRA_COLUMNS, weitere als `col<N>`. */
  extra: Record<string, string | number | boolean | null>;
};

/**
 * Zusatzspalten des Servers ts12.x1.europe (verifiziert an echter map.sql: 16 Spalten, Position 11..15).
 * Die Bedeutung von Position 12 (isCapital) folgt der Reihenfolge aus dem CC-Auftrag; die Werte sind TRUE/FALSE.
 */
export const EXTRA_COLUMNS = ["region", "isCapital", "isCity", "hasHarbor", "victoryPoints"] as const;
