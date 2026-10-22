import type { PrismaClient } from "@prisma/client";
import { env } from "./env";
import { parseIdList } from "./ids";

/** Admin-UI-Overrides (Tabelle Setting) schlagen die ENV-Defaults. */
export async function getInactiveDays(db: PrismaClient): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: "inactiveDays" } });
  const n = row ? Number(row.value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : env().INACTIVE_DAYS;
}

/** Konfigurierte Haupt-Allianzen: Setting `allianceId` (Admin) schlägt ENV; beide kommagetrennt. */
export async function getAllianceIds(db: PrismaClient): Promise<number[]> {
  const row = await db.setting.findUnique({ where: { key: "allianceId" } });
  const fromSetting = parseIdList(row?.value);
  return fromSetting.length > 0 ? fromSetting : env().TRAVIAN_ALLIANCE_IDS;
}
