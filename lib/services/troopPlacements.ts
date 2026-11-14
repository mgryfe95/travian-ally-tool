import type { PrismaClient } from "@prisma/client";
import { parseCoordStr } from "../ai/reading";
import { ForbiddenError } from "../permissions";
import { TroopsError } from "../troops";
import { getOwnVillage } from "./villages";

const MAX_PER_VILLAGE = 30;
const MAX_COUNT = 100_000_000;

export type Placement = { id: number; villageId: number; x: number; y: number; unit: string; count: number; note: string; target: string | null; player: string | null };

/** Manuelle Angabe: eigene Truppen aus `villageId` stehen im Dorf an `coord` (z. B. „1000 Truppen in MG“). */
export async function addTroopPlacement(db: PrismaClient, userId: string, villageId: number, input: { coord: string; unit?: string; count: string | number; note?: string }) {
  const home = await getOwnVillage(db, userId, villageId);
  if (!home) throw new ForbiddenError("err.village.notOwn");
  const xy = parseCoordStr(input.coord);
  if (!xy) throw new TroopsError("err.troops.placeCoord");
  if (xy[0] === home.x && xy[1] === home.y) throw new TroopsError("err.troops.placeSelf");
  const count = Number(String(input.count).replace(/[.\s]/g, ""));
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) throw new TroopsError("err.troops.placeCount");
  const unit = (input.unit ?? "").trim();
  if (unit.length > 40) throw new TroopsError("err.troops.placeUnit");
  if ((await db.troopPlacement.count({ where: { villageId, userId } })) >= MAX_PER_VILLAGE) throw new TroopsError("err.troops.placeTooMany", { max: MAX_PER_VILLAGE });
  return db.troopPlacement.create({ data: { userId, villageId, x: xy[0], y: xy[1], unit, count, note: (input.note ?? "").trim().slice(0, 200) } });
}

export async function deleteTroopPlacement(db: PrismaClient, userId: string, id: number) {
  const r = await db.troopPlacement.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw new ForbiddenError("err.village.notOwn");
}

/** Angaben je Heimatdorf, mit Zieldorf und Besitzer aus den Kartendaten (falls bekannt). */
export async function listTroopPlacements(db: PrismaClient, villageIds: number[]): Promise<Placement[]> {
  if (!villageIds.length) return [];
  const rows = await db.troopPlacement.findMany({ where: { villageId: { in: villageIds } }, orderBy: { id: "asc" } });
  const targets = rows.length ? await db.village.findMany({ where: { OR: rows.map((r) => ({ x: r.x, y: r.y })) }, select: { x: true, y: true, name: true, playerId: true } }) : [];
  const players = new Map((await db.player.findMany({ where: { id: { in: targets.map((v) => v.playerId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const at = new Map(targets.map((v) => [`${v.x}|${v.y}`, v]));
  return rows.map((r) => {
    const v = at.get(`${r.x}|${r.y}`);
    return { id: r.id, villageId: r.villageId, x: r.x, y: r.y, unit: r.unit, count: r.count, note: r.note, target: v?.name ?? null, player: v ? (players.get(v.playerId) ?? null) : null };
  });
}
