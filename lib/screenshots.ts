import type { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { storage } from "./storage";

const FULL_MAX = 2600; // Handy-Screenshots (~1080×2400) bleiben in voller Auflösung, damit Ziffern lesbar bleiben
const THUMB = 400;

/** Komprimiert beim Upload: WebP (Qualität 88, ohne Metadaten) + Vorschau. Typisch 70–85 % kleiner als das PNG-Original. */
export async function compressScreenshot(input: Buffer) {
  const base = sharp(input, { failOn: "error" }).rotate();
  const full = await base.clone().resize({ width: FULL_MAX, height: FULL_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
  const thumb = await base.clone().resize({ width: THUMB, height: THUMB, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  return { full: full.data, thumb, width: full.info.width, height: full.info.height };
}

/** Löscht Screenshot samt Dateien und die daraus entstandenen Lern-Beispiele (die Bilddatei existiert danach nicht mehr). */
export async function deleteScreenshotFiles(db: PrismaClient, ids: number[]): Promise<number> {
  const rows = await db.screenshot.findMany({ where: { id: { in: ids } } });
  for (const r of rows) {
    await db.visionExample.deleteMany({ where: { storageKey: r.storageKey } });
    for (const key of [r.storageKey, r.thumbKey]) if (key) await storage().delete(key);
  }
  await db.screenshot.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  return rows.length;
}

/** Aufbewahrung: Screenshots älter als `days` Tage löschen – außer sie dienen als Lern-Beispiel. 0 Tage = aus. */
export async function purgeOldScreenshots(db: PrismaClient, days: number, now = new Date()): Promise<number> {
  if (days <= 0) return 0;
  const old = await db.screenshot.findMany({ where: { createdAt: { lt: new Date(now.getTime() - days * 86_400_000) } }, select: { id: true, storageKey: true } });
  if (old.length === 0) return 0;
  const keep = new Set((await db.visionExample.findMany({ where: { storageKey: { in: old.map((o) => o.storageKey) } }, select: { storageKey: true } })).map((e) => e.storageKey));
  const del = old.filter((o) => !keep.has(o.storageKey)).map((o) => o.id);
  return del.length ? deleteScreenshotFiles(db, del) : 0;
}

export type MyFile = { type: "screenshot" | "attachment"; id: number; name: string; kind: string; sizeBytes: number; createdAt: Date; thumbUrl: string | null; url: string; note: string };

/** „Meine Bilder & Dateien“: eigene Screenshots und Chat-Anhänge. */
export async function listMyFiles(db: PrismaClient, userId: string): Promise<{ files: MyFile[]; totalBytes: number }> {
  const [shots, atts] = await Promise.all([
    db.screenshot.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.attachment.findMany({ where: { uploaderId: userId }, orderBy: { createdAt: "desc" }, include: { message: { select: { channel: { select: { name: true } }, deletedAt: true } } } }),
  ]);
  const files: MyFile[] = [
    ...shots.map((s) => ({ type: "screenshot" as const, id: s.id, name: `Screenshot ${s.id}`, kind: s.detectedKind, sizeBytes: s.sizeBytes, createdAt: s.createdAt, thumbUrl: s.thumbKey ? `/api/screenshots/${s.id}/file?v=thumb` : null, url: `/api/screenshots/${s.id}/file`, note: s.status })),
    ...atts.map((a) => ({ type: "attachment" as const, id: a.id, name: a.name, kind: a.kind, sizeBytes: a.sizeBytes, createdAt: a.createdAt, thumbUrl: a.thumbKey ? `/api/attachments/${a.id}?v=thumb` : null, url: `/api/attachments/${a.id}?v=dl`, note: a.message ? `Kanal ${a.message.channel.name}${a.message.deletedAt ? " (Nachricht gelöscht)" : ""}` : "nicht gesendet" })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { files, totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0) };
}

/** Eigenen Anhang löschen (Dateien + Zeile); die Nachricht bleibt ohne den Anhang. */
export async function deleteOwnAttachment(db: PrismaClient, userId: string, id: number): Promise<boolean> {
  const a = await db.attachment.findFirst({ where: { id, uploaderId: userId } });
  if (!a) return false;
  for (const key of [a.storageKey, a.thumbKey, a.previewKey]) if (key) await storage().delete(key);
  await db.attachment.delete({ where: { id } });
  return true;
}
