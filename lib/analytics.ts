import type { MapRow } from "./mapsql/types";

export type PlayerStatus = "active" | "stagnant" | "inactive" | "declining";

export type PopPoint = { date: string; population: number };

export type PlayerMetrics = {
  status: PlayerStatus;
  /** Anzahl aufeinanderfolgender Tage (Snapshots) ohne Bevölkerungszuwachs, vom neuesten rückwärts. */
  noGrowthDays: number;
  delta1: number | null;
  delta3: number | null;
  delta7: number | null;
};

const DAY = 86_400_000;
const dayNum = (d: string) => Math.floor(Date.parse(d + "T00:00:00Z") / DAY);

/**
 * `series` aufsteigend nach Datum (YYYY-MM-DD).
 * - active: letzter Snapshot hat Zuwachs (oder weniger als 2 Snapshots)
 * - inactive: ≥ inactiveDays Snapshots in Folge ohne Zuwachs
 * - declining: Rückgang zum Vor-Snapshot (und noch nicht inactive)
 * - stagnant: kein Zuwachs seit 1..inactiveDays-1 Snapshots
 * Deltas: Differenz zum jüngsten Snapshot am oder vor (neuestes Datum − n Tage); null, wenn es keinen gibt.
 */
export function computePlayerMetrics(series: PopPoint[], inactiveDays: number): PlayerMetrics {
  const last = series[series.length - 1];
  if (!last) return { status: "active", noGrowthDays: 0, delta1: null, delta3: null, delta7: null };

  let noGrowthDays = 0;
  for (let i = series.length - 1; i > 0; i--) {
    if ((series[i] as PopPoint).population <= (series[i - 1] as PopPoint).population) noGrowthDays++;
    else break;
  }

  const prev = series[series.length - 2];
  let status: PlayerStatus;
  if (noGrowthDays >= inactiveDays) status = "inactive";
  else if (prev && last.population < prev.population) status = "declining";
  else if (noGrowthDays >= 1) status = "stagnant";
  else status = "active";

  const delta = (n: number): number | null => {
    const target = dayNum(last.date) - n;
    for (let i = series.length - 2; i >= 0; i--) {
      const p = series[i] as PopPoint;
      if (dayNum(p.date) <= target) return last.population - p.population;
    }
    return null;
  };
  return { status, noGrowthDays, delta1: delta(1), delta3: delta(3), delta7: delta(7) };
}

export type MapEvent =
  | { type: "village_new"; villageId: number; playerId: number }
  | { type: "village_lost"; villageId: number; playerId: number }
  | { type: "village_conquered"; villageId: number; playerId: number; otherPlayerId: number }
  | { type: "alliance_change"; playerId: number; fromAllianceId: number; toAllianceId: number }
  | { type: "player_gone"; playerId: number };

/**
 * Diff zweier Karten-Stände. Ohne Vorgänger (`prev` leer) gibt es bewusst keine Events,
 * damit der Erstimport keinen Feed mit 23k "neuen Dörfern" erzeugt.
 */
export type DiffRow = Pick<MapRow, "villageId" | "playerId" | "allianceId">;

export function diffSnapshots(prev: DiffRow[], next: DiffRow[]): MapEvent[] {
  if (prev.length === 0) return [];
  const events: MapEvent[] = [];
  const prevV = new Map(prev.map((r) => [r.villageId, r]));
  const nextV = new Map(next.map((r) => [r.villageId, r]));

  for (const [id, n] of nextV) {
    const p = prevV.get(id);
    if (!p) events.push({ type: "village_new", villageId: id, playerId: n.playerId });
    else if (p.playerId !== n.playerId)
      events.push({ type: "village_conquered", villageId: id, playerId: n.playerId, otherPlayerId: p.playerId });
  }
  for (const [id, p] of prevV) if (!nextV.has(id)) events.push({ type: "village_lost", villageId: id, playerId: p.playerId });

  const allianceOf = (rows: DiffRow[]) => new Map(rows.map((r) => [r.playerId, r.allianceId]));
  const pa = allianceOf(prev);
  const na = allianceOf(next);
  for (const [pid, from] of pa) {
    const to = na.get(pid);
    if (to === undefined) events.push({ type: "player_gone", playerId: pid });
    else if (to !== from) events.push({ type: "alliance_change", playerId: pid, fromAllianceId: from, toAllianceId: to });
  }
  return events;
}
