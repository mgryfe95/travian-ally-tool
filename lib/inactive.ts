import type { PrismaClient } from "@prisma/client";
import { distance, type Coord } from "./geo";
import type { PlayerStatus } from "./analytics";

export type Candidate = {
  villageId: number;
  villageName: string;
  x: number;
  y: number;
  villagePop: number;
  playerId: number;
  playerName: string;
  playerPop: number;
  tribe: number;
  allianceId: number;
  allianceName: string;
  status: PlayerStatus;
  noGrowthDays: number;
  delta7: number | null;
};

export type SortKey = "distance" | "population" | "days";

export type InactiveFilters = {
  maxDistance?: number;
  minPop?: number;
  maxPop?: number;
  minDays?: number;
  allianceId?: number;
  tribe?: number;
  /** Allianz-IDs, die ausgeblendet werden (z. B. eigene Gruppe). */
  excludeAllianceIds?: ReadonlySet<number>;
  statuses?: PlayerStatus[];
  sort?: SortKey;
  dir?: "asc" | "desc";
};

export type Result = Candidate & { distance: number };

/** Reine Such-/Sortierlogik; Entfernung kommt aus `distance` (Kartenwrap), damit sie später für Laufzeiten wiederverwendbar bleibt. */
export function searchInactive(candidates: Candidate[], origin: Coord, f: InactiveFilters = {}): Result[] {
  const statuses = f.statuses ?? ["inactive"];
  const out = candidates
    .filter((c) => statuses.includes(c.status))
    .filter((c) => f.minPop === undefined || c.playerPop >= f.minPop)
    .filter((c) => f.maxPop === undefined || c.playerPop <= f.maxPop)
    .filter((c) => f.minDays === undefined || c.noGrowthDays >= f.minDays)
    .filter((c) => f.allianceId === undefined || c.allianceId === f.allianceId)
    .filter((c) => f.tribe === undefined || c.tribe === f.tribe)
    .filter((c) => !f.excludeAllianceIds?.has(c.allianceId))
    .map((c) => ({ ...c, distance: distance(origin, c) }))
    .filter((c) => f.maxDistance === undefined || c.distance <= f.maxDistance);

  const key = f.sort ?? "distance";
  const sign = (f.dir ?? (key === "distance" ? "asc" : "desc")) === "asc" ? 1 : -1;
  const val = (r: Result) => (key === "distance" ? r.distance : key === "population" ? r.playerPop : r.noGrowthDays);
  return out.sort((a, b) => sign * (val(a) - val(b)) || a.distance - b.distance || a.villageId - b.villageId);
}

/** Lädt Kandidaten (Dörfer von Spielern mit passendem Status) aus der aktuellen Sicht. */
export async function loadCandidates(db: PrismaClient, statuses: PlayerStatus[] = ["inactive"]): Promise<Candidate[]> {
  const players = await db.player.findMany({ where: { status: { in: statuses } } });
  const alliances = new Map((await db.alliance.findMany()).map((a) => [a.id, a.name]));
  const byId = new Map(players.map((p) => [p.id, p]));
  const ids = [...byId.keys()];
  const out: Candidate[] = [];
  for (let i = 0; i < ids.length; i += 20_000) {
    const villages = await db.village.findMany({ where: { playerId: { in: ids.slice(i, i + 20_000) } } });
    for (const v of villages) {
      const p = byId.get(v.playerId)!;
      out.push({
        villageId: v.id, villageName: v.name, x: v.x, y: v.y, villagePop: v.population,
        playerId: p.id, playerName: p.name, playerPop: p.population, tribe: p.tribe,
        allianceId: p.allianceId, allianceName: alliances.get(p.allianceId) ?? "", status: p.status as PlayerStatus,
        noGrowthDays: p.noGrowthDays, delta7: p.delta7,
      });
    }
  }
  return out;
}

export const TRIBES: Record<number, string> = { 1: "Römer", 2: "Germanen", 3: "Gallier", 4: "Natur", 5: "Natars", 6: "Ägypter", 7: "Hunnen", 8: "Spartaner" };

/** Akzeptiert `(12|-34)`, `12|-34`, `12/-34` oder `12,-34`; Koordinaten müssen im Kartenbereich liegen. */
export function parseCoord(input: string, radius = 200): Coord | undefined {
  const m = /^\s*\(?\s*(-?\d{1,3})\s*[|/,;]\s*(-?\d{1,3})\s*\)?\s*$/.exec(input);
  if (!m) return undefined;
  const x = Number(m[1]);
  const y = Number(m[2]);
  return Math.abs(x) <= radius && Math.abs(y) <= radius ? { x, y } : undefined;
}
