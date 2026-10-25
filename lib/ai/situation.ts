import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { GOAL_HINT, isGoal } from "./goals";
import { buildingInfos } from "../gamedata/names";
import { troopUpkeep } from "../gamedata/upkeep";
import { ageInDays } from "../reminders";
import { readTroops } from "../troops";
import { ownVillages } from "../services/villages";

type Res4 = { wood?: number; clay?: number; iron?: number; crop?: number };
type Lvl = { slot?: number | null; name?: string | null; level: number; type?: string | null };
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = <T>(v: unknown): T => (v && typeof v === "object" ? (v as T) : ({} as T));

export type SituationVillage = {
  id: number; name: string; coords: string; population: number;
  goal: string | null; instructions: string;
  /** Alter der Daten in Tagen (null = nie erfasst) – nicht Teil des Hashs */
  dataAgeDays: { troops: number | null; resources: number | null; buildings: number | null };
  resources: { stock?: Res4; capacity?: { warehouse?: number; granary?: number }; productionPerHour?: Res4 } | null;
  fields: { type: string; levels: number[] }[];
  buildings: { name: string; level: number; maxed: boolean; nextCost: string; benefitNow: string; benefitNext: string }[];
  troops: { unit: string; home: number; away: number; supportElsewhere: number }[];
  troopUpkeepPerHour: number | null;
  queue: unknown;
};
export type Situation = {
  account: { tribe: number | null; instructions: string; villages: number };
  villages: SituationVillage[];
  /** Offene Vorschläge des letzten Laufs und was der Nutzer damit gemacht hat (Kontinuität, keine Wiederholung erledigter Punkte) */
  previous: { title: string; villageId: number | null; status: string }[];
};

/** Deterministisches Lagebild eines Accounts – nur eigene Daten (alle Abfragen mit userId des Aufrufers). */
export async function buildSituation(db: PrismaClient, userId: string, now = new Date()): Promise<Situation> {
  const [villages, me, profiles, prev] = await Promise.all([
    ownVillages(db, userId),
    db.user.findUnique({ where: { id: userId }, select: { aiInstructions: true } }),
    db.villageProfile.findMany({ where: { userId } }),
    db.recommendation.findMany({ where: { userId, status: { in: ["open", "done", "dismissed"] } }, orderBy: { id: "desc" }, take: 20, select: { title: true, villageId: true, status: true } }),
  ]);
  const prof = new Map(profiles.map((p) => [p.villageId, p]));
  const tribe = villages[0] ? (await db.player.findUnique({ where: { id: villages[0].playerId }, select: { tribe: true } }))?.tribe ?? null : null;
  const units = tribe ? await db.unitName.findMany({ where: { tribeVid: tribe } }) : [];
  const slotByName = new Map(units.flatMap((u) => [[u.nameEn.toLowerCase(), u.slot] as const, ...(u.nameDe ? [[u.nameDe.toLowerCase(), u.slot] as const] : [])]));
  const upkeepDb = new Map(units.flatMap((u) => (u.upkeep != null ? [[u.slot, u.upkeep] as const] : [])));

  const out: SituationVillage[] = [];
  for (const v of villages) {
    const s = v.state;
    const p = prof.get(v.id);
    const res = obj<{ stock?: Res4; production?: Res4; capacity?: { warehouse?: number; granary?: number } }>(s?.resources);
    const fieldsRaw = arr<Lvl>(s?.fields);
    const byType = new Map<string, number[]>();
    for (const f of fieldsRaw) { const k = f.type || "unknown"; byType.set(k, [...(byType.get(k) ?? []), f.level]); }
    const buildingsRaw = arr<Lvl>(s?.buildings).filter((b) => b.name);
    const info = await buildingInfos(db, buildingsRaw, "en", (n) => String(n));
    const troops = readTroops(s?.troops);
    const upkeep = troops.length ? troopUpkeep(tribe, troops.map((t) => ({ unit: t.unit, count: t.inVillage + t.away + t.support })), slotByName, upkeepDb) : null;
    out.push({
      id: v.id, name: v.name, coords: `${v.x}|${v.y}`, population: v.population,
      goal: isGoal(p?.goal) ? `${p!.goal} (${GOAL_HINT[p!.goal]})` : null,
      instructions: p?.aiInstructions ?? "",
      dataAgeDays: { troops: ageInDays(s?.troopsAt ?? null, now), resources: ageInDays(s?.resourcesAt ?? null, now), buildings: ageInDays(s?.buildingsAt ?? null, now) },
      resources: s?.resources ? { stock: res.stock, capacity: res.capacity, productionPerHour: res.production } : null,
      fields: [...byType].map(([type, levels]) => ({ type, levels: levels.sort((a, b) => a - b) })),
      buildings: buildingsRaw.map((b, i) => { const x = info.get(i); return { name: b.name!, level: b.level, maxed: x?.maxed ?? false, nextCost: x?.nextCost ?? "?", benefitNow: x?.benefit ?? "?", benefitNext: x?.benefitAfter ?? "?" }; }),
      troops: troops.map((t) => ({ unit: t.unit, home: t.inVillage, away: t.away, supportElsewhere: t.support })),
      troopUpkeepPerHour: upkeep && upkeep.unknown === 0 ? upkeep.total : null,
      queue: obj<{ construction?: unknown }>(s?.queues).construction ?? null,
    });
  }
  return { account: { tribe, instructions: me?.aiInstructions ?? "", villages: villages.length }, villages: out, previous: prev };
}

/** Hash ohne Datenalter und ohne frühere Vorschläge: nur unveränderte Spieldaten/Ziele → kein neuer (kostenpflichtiger) Lauf. */
export function situationHash(s: Situation): string {
  const stable = { account: s.account, villages: s.villages.map((v) => ({ ...v, dataAgeDays: undefined })) };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
