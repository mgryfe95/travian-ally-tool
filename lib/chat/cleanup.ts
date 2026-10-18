import type { PrismaClient } from "@prisma/client";
import { storage } from "../storage";

/** Verwaiste Uploads (nie an eine Nachricht gehängt) nach `maxAgeMs` samt Dateien löschen. */
export async function cleanupOrphanAttachments(db: PrismaClient, maxAgeMs = 24 * 3_600_000, now = new Date()): Promise<number> {
  const orphans = await db.attachment.findMany({ where: { messageId: null, dmMessageId: null, createdAt: { lt: new Date(now.getTime() - maxAgeMs) } } });
  for (const a of orphans) {
    for (const key of [a.storageKey, a.thumbKey, a.previewKey]) if (key) await storage().delete(key);
  }
  if (orphans.length) await db.attachment.deleteMany({ where: { id: { in: orphans.map((a) => a.id) } } });
  return orphans.length;
}
