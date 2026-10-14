import type { PrismaClient } from "@prisma/client";
import { env } from "./env";

/** Admin-UI-Overrides (Tabelle Setting) schlagen die ENV-Defaults. */
export async function getInactiveDays(db: PrismaClient): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: "inactiveDays" } });
  const n = row ? Number(row.value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : env().INACTIVE_DAYS;
}

export async function getAllianceId(db: PrismaClient): Promise<number | undefined> {
  const row = await db.setting.findUnique({ where: { key: "allianceId" } });
  const n = row ? Number(row.value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : env().TRAVIAN_ALLIANCE_ID;
}
