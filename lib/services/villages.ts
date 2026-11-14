import type { PrismaClient } from "@prisma/client";
import { isGoal } from "../ai/goals";
import { ForbiddenError } from "../permissions";
import { DEFAULT_STALE_DAYS } from "../reminders";
import { AppError } from "../i18n/errors";

export const MAX_INSTRUCTIONS = 4000;

export class VillageError extends AppError {}

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
  if (t.length > MAX_INSTRUCTIONS) throw new VillageError("err.village.tooLong", { max: MAX_INSTRUCTIONS });
  return t;
}

export async function saveAccountInstructions(db: PrismaClient, userId: string, text: string) {
  await db.user.update({ where: { id: userId }, data: { aiInstructions: clean(text) } });
}

/** `goal` (Dorftyp): undefined = unverändert, "" = offen, sonst einer aus VILLAGE_GOALS. */
export async function saveVillageInstructions(db: PrismaClient, userId: string, villageId: number, text: string, goal?: string) {
  if (!(await getOwnVillage(db, userId, villageId))) throw new ForbiddenError("err.village.notOwn");
  const aiInstructions = clean(text);
  if (goal !== undefined && goal !== "" && !isGoal(goal)) throw new VillageError("err.village.badGoal");
  const g = goal === undefined ? {} : { goal: goal || null };
  await db.villageProfile.upsert({ where: { villageId_userId: { villageId, userId } }, create: { villageId, userId, aiInstructions, ...g }, update: { aiInstructions, ...g } });
}

export async function getVillageGoal(db: PrismaClient, userId: string, villageId: number) {
  return (await db.villageProfile.findUnique({ where: { villageId_userId: { villageId, userId } } }))?.goal ?? "";
}

export async function getVillageInstructions(db: PrismaClient, userId: string, villageId: number) {
  return (await db.villageProfile.findUnique({ where: { villageId_userId: { villageId, userId } } }))?.aiInstructions ?? "";
}

export type BuildingEntry = { slot: number | null; name: string | null; level: number };

/** Gebäudeliste eines eigenen Dorfes von Hand korrigieren (Name je Platz, Stufe). */
export async function saveBuildings(db: PrismaClient, userId: string, villageId: number, input: BuildingEntry[], now = new Date()) {
  if (!(await getOwnVillage(db, userId, villageId))) throw new ForbiddenError("err.village.notOwn");
  if (!Array.isArray(input) || input.length > 60) throw new VillageError("err.village.buildingsInvalid");
  const list = input.map((b) => {
    const level = Number(b.level);
    const slot = b.slot === null || b.slot === undefined || Number.isNaN(Number(b.slot)) ? null : Number(b.slot);
    const name = typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, 60) : null;
    if (!Number.isInteger(level) || level < 0 || level > 30 || (slot !== null && (!Number.isInteger(slot) || slot < 1 || slot > 40))) throw new VillageError("err.village.buildingsInvalid");
    return { slot, name, level };
  });
  const data = { buildings: list, buildingsAt: now, userId, capturedAt: now };
  await db.villageState.upsert({ where: { villageId }, create: { ...data, villageId }, update: data });
}
