import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteOwnAttachment, deleteScreenshotFiles, listMyFiles, purgeOldScreenshots } from "@/lib/screenshots";
import { storage } from "@/lib/storage";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const now = new Date("2026-10-15T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

async function shot(userId: string, name: string, createdAt: Date) {
  const key = `shots/${userId}/${name}.webp`;
  await storage().put(key, Buffer.from("x".repeat(100)));
  await storage().put(`shots/${userId}/${name}.thumb.webp`, Buffer.from("t"));
  return db.screenshot.create({ data: { userId, storageKey: key, thumbKey: `shots/${userId}/${name}.thumb.webp`, sizeBytes: 101, createdAt } });
}

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "Screenshot","VisionExample","Attachment","Message","Channel" RESTART IDENTITY CASCADE`;
});
afterAll(() => db.$disconnect());

describe("Aufbewahrung und eigene Dateien", () => {
  it("löscht alte Screenshots samt Dateien, außer Lern-Beispiele; 0 Tage = aus", async () => {
    const old = await shot("u1", "old", daysAgo(40));
    const keep = await shot("u1", "keep", daysAgo(40));
    const fresh = await shot("u1", "fresh", daysAgo(5));
    await db.visionExample.create({ data: { kind: "VILLAGE_TROOPS", storageKey: keep.storageKey, gold: {}, createdBy: "u1" } });
    expect(await purgeOldScreenshots(db, 0, now)).toBe(0);
    expect(await purgeOldScreenshots(db, 30, now)).toBe(1);
    expect(await storage().exists(old.storageKey)).toBe(false);
    expect(await storage().exists(old.thumbKey!)).toBe(false);
    expect(await storage().exists(keep.storageKey)).toBe(true);
    expect(await storage().exists(fresh.storageKey)).toBe(true);
  });
  it("Selbst löschen entfernt auch die daraus entstandenen Beispiele; Liste zeigt Größe", async () => {
    const a = await shot("u2", "a", daysAgo(1));
    await db.visionExample.create({ data: { kind: "RALLY_POINT", storageKey: a.storageKey, gold: {}, createdBy: "u2" } });
    const list = await listMyFiles(db, "u2");
    expect(list.files).toHaveLength(1);
    expect(list.totalBytes).toBe(101);
    await deleteScreenshotFiles(db, [a.id]);
    expect(await db.visionExample.count()).toBe(0);
    expect((await listMyFiles(db, "u2")).files).toHaveLength(0);
  });
  it("eigenen Anhang löschen: nur der Uploader", async () => {
    await storage().put("att/u3/f.png", Buffer.from("z"));
    const att = await db.attachment.create({ data: { uploaderId: "u3", kind: "image", mime: "image/png", name: "f.png", sizeBytes: 1, storageKey: "att/u3/f.png" } });
    expect(await deleteOwnAttachment(db, "fremd", att.id)).toBe(false);
    expect(await deleteOwnAttachment(db, "u3", att.id)).toBe(true);
    expect(await storage().exists("att/u3/f.png")).toBe(false);
  });
});

describe("Speicher-Kontingent und entfernte Anhänge", () => {
  it("zählt Screenshots + aktive Anhänge; Löschen gibt Platz frei und hinterlässt einen Platzhalter", async () => {
    const { usedBytes, assertQuota } = await import("@/lib/quota");
    await shot("q1", "a", daysAgo(1)); // 101 Byte
    const att = await db.attachment.create({ data: { uploaderId: "q1", kind: "image", mime: "image/png", name: "x.png", sizeBytes: 900, storageKey: "att/q1/orig.png" } });
    expect(await usedBytes(db, "q1")).toBe(1001);
    await expect(assertQuota(db, "q1", 100, 1100)).rejects.toMatchObject({ status: 413, key: "err.quota.exceeded" });
    await expect(assertQuota(db, "q1", 99, 1100)).resolves.toBeUndefined();
    await expect(assertQuota(db, "q1", 10_000_000, 0)).resolves.toBeUndefined(); // 0 = unbegrenzt
    expect(await deleteOwnAttachment(db, "q1", att.id)).toBe(true);
    expect(await usedBytes(db, "q1")).toBe(101);
    expect((await db.attachment.findUnique({ where: { id: att.id } }))?.removedAt).not.toBeNull();
    expect((await listMyFiles(db, "q1")).files.every((f) => f.type === "screenshot")).toBe(true);
  });
});
