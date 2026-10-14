import type { PrismaClient } from "@prisma/client";
import { ForbiddenError } from "../permissions";
import { DEFAULT_STALE_DAYS } from "../reminders";

export const MAX_INSTRUCTIONS = 4000;

export class VillageError extends Error {}

export async function getStaleDays(db: PrismaClient): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: "staleDays" } });
  const n = row ? Number(row.value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_STALE_DAYS;
}

/** Eigene Dörfer = Dörfer der Spieler, mit denen das Konto verifiziert verknüpft ist (map.sql-Stand). */
export async function ownVillages(db: PrismaClient, userId: string) {
  const links = await db.playerLink.findMany({ where: { userId, status: "verified" }, select: { travianPlayerId: true } });
  if (links.length === 0) return [];
  const villages = await db.village.findMany({ where: { playerId: { in: links.map((l) => l.travianPlayerId) } }, orderBy: [{ population: "desc" }, { id: "asc" }] });
  const states = await db.villageState.findMany({ where: { villageId: { in: villages.map((v) => v.id) } } });
  const byId = new Map(states.map((s) => [s.villageId, s]));
  return villages.map((v) => ({ ...v, state: byId.get(v.id) ?? null }));
}

/** Dorf nur, wenn es einem verifizierten Spieler des Kontos gehört; sonst null (Aufrufer antwortet mit 404). */
export async function getOwnVillage(db: PrismaClient, userId: string, villageId: number) {
  return (await ownVillages(db, userId)).find((v) => v.id === villageId) ?? null;
}

function clean(text: string) {
  const t = text.replace(/\r\n?/g, "\n").trim();
  if (t.length > MAX_INSTRUCTIONS) throw new VillageError(`Zu lang (max. ${MAX_INSTRUCTIONS} Zeichen)`);
  return t;
}

export async function saveAccountInstructions(db: PrismaClient, userId: string, text: string) {
  await db.user.update({ where: { id: userId }, data: { aiInstructions: clean(text) } });
}

export async function saveVillageInstructions(db: PrismaClient, userId: string, villageId: number, text: string) {
  if (!(await getOwnVillage(db, userId, villageId))) throw new ForbiddenError("Dieses Dorf gehört nicht zu deinem Konto");
  const aiInstructions = clean(text);
  await db.villageProfile.upsert({ where: { villageId_userId: { villageId, userId } }, create: { villageId, userId, aiInstructions }, update: { aiInstructions } });
}

export async function getVillageInstructions(db: PrismaClient, userId: string, villageId: number) {
  return (await db.villageProfile.findUnique({ where: { villageId_userId: { villageId, userId } } }))?.aiInstructions ?? "";
}
