import type { PrismaClient } from "@prisma/client";
import type { UnitCount } from "../incidents";

export type SideValue = { tribe: number | null; total: number; upkeep: number; items: { unit: string; count: number; value: number | null }[]; unknown: string[] };
export type LossComparison = { attacker: SideValue; defender: SideValue; moreLost: "attacker" | "defender" | "equal" | "unknown" };

const list = (v: unknown): UnitCount[] => (Array.isArray(v) ? (v as UnitCount[]).filter((u) => u && typeof u.unit === "string" && Number.isFinite(u.count)) : []);

/** Wert verlorener Einheiten in Rohstoffen (Summe Holz+Lehm+Eisen+Getreide je Einheit aus `UnitName.costTotal`) und entfallender Unterhalt. */
export async function sideValue(db: PrismaClient, tribe: number | null, units: UnitCount[]): Promise<SideValue> {
  const rows = tribe ? await db.unitName.findMany({ where: { tribeVid: tribe } }) : await db.unitName.findMany();
  const by = new Map<string, (typeof rows)[number]>();
  for (const r of rows) for (const n of [r.nameEn, r.nameDe]) if (n && !by.has(n.toLowerCase())) by.set(n.toLowerCase(), r);
  let total = 0, upkeep = 0;
  const unknown: string[] = [];
  const items = units.map((u) => {
    const r = by.get(u.unit.trim().toLowerCase());
    if (!r?.costTotal) { unknown.push(u.unit); return { unit: u.unit, count: u.count, value: null }; }
    total += r.costTotal * u.count;
    upkeep += (r.upkeep ?? 0) * u.count;
    return { unit: u.unit, count: u.count, value: r.costTotal * u.count };
  });
  return { tribe, total, upkeep, items, unknown };
}

/** Wer hat mehr geopfert? Verluste beider Seiten eines Incidents (aus dem Kampfbericht) in Rohstoffen. */
export async function compareLosses(db: PrismaClient, i: { userId: string; villageId: number; attackerPlayerId: number | null; attackerLosses: unknown; defenderLosses: unknown }): Promise<LossComparison> {
  const village = await db.village.findUnique({ where: { id: i.villageId }, select: { playerId: true } });
  const [own, att] = await Promise.all([
    village ? db.player.findUnique({ where: { id: village.playerId }, select: { tribe: true } }) : null,
    i.attackerPlayerId ? db.player.findUnique({ where: { id: i.attackerPlayerId }, select: { tribe: true } }) : null,
  ]);
  const attacker = await sideValue(db, att?.tribe ?? null, list(i.attackerLosses));
  const defender = await sideValue(db, own?.tribe ?? null, list(i.defenderLosses));
  const known = attacker.unknown.length === 0 && defender.unknown.length === 0 && (attacker.items.length > 0 || defender.items.length > 0);
  const moreLost = !known ? "unknown" : attacker.total === defender.total ? "equal" : attacker.total > defender.total ? "attacker" : "defender";
  return { attacker, defender, moreLost };
}
