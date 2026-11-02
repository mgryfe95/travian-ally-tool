import type { PrismaClient } from "@prisma/client";
import { env } from "./env";
import { AppError } from "./i18n/errors";

const MB = 1_048_576;

/** Belegter Speicher eines Nutzers: eigene Screenshots + nicht entfernte Chat-Dateien. */
export async function usedBytes(db: PrismaClient, userId: string): Promise<number> {
  const [s, a] = await Promise.all([
    db.screenshot.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
    db.attachment.aggregate({ where: { uploaderId: userId, removedAt: null }, _sum: { sizeBytes: true } }),
  ]);
  return (s._sum.sizeBytes ?? 0) + (a._sum.sizeBytes ?? 0);
}

export const quotaBytes = (): number => Math.round(env().USER_QUOTA_MB * MB);

/** Wirft 413, wenn `addBytes` das Kontingent sprengen würde (0 MB = unbegrenzt). */
export async function assertQuota(db: PrismaClient, userId: string, addBytes: number, limit = quotaBytes()): Promise<void> {
  if (limit <= 0) return;
  const used = await usedBytes(db, userId);
  if (used + addBytes > limit) {
    throw new QuotaError("err.quota.exceeded", { used: (used / MB).toFixed(1), limit: (limit / MB).toFixed(0) });
  }
}

export class QuotaError extends AppError {
  readonly status = 413;
}
