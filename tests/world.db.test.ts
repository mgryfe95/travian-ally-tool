import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getWorldStatus, recordImportOutcome, startNewWorld } from "@/lib/services/world";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "Setting","User","Player","Village","PlayerLink","Invite","AllianceClassification","AuditLog","Channel","Message" RESTART IDENTITY CASCADE`;
});
afterAll(() => db.$disconnect());

describe("Weltende-Erkennung", () => {
  it("erst nach `threshold` Fehlschlägen in Folge beendet; ein Erfolg setzt zurück", async () => {
    for (let i = 0; i < 2; i++) expect((await recordImportOutcome(db, false, { threshold: 3 })).status).toBe("active");
    expect((await recordImportOutcome(db, false, { threshold: 3 })).status).toBe("ended");
    expect((await getWorldStatus(db)).endedAt).not.toBeNull();
    const ok = await recordImportOutcome(db, true, { now: new Date("2026-10-14T10:00:00Z") });
    expect(ok).toMatchObject({ status: "active", failures: 0 });
    expect(ok.lastSuccessAt?.toISOString()).toBe("2026-10-14T10:00:00.000Z");
  });
  it("Fehlschläge unterhalb der Schwelle werden durch einen Erfolg gelöscht", async () => {
    await recordImportOutcome(db, false, { threshold: 3 });
    await recordImportOutcome(db, false, { threshold: 3 });
    await recordImportOutcome(db, true);
    expect((await recordImportOutcome(db, false, { threshold: 3 })).failures).toBe(1);
  });
});

describe("Neue Welt", () => {
  it("leert Weltdaten, behält Konten/Chat, stuft Member auf Gast herab, Staff bleibt", async () => {
    await db.user.createMany({ data: [{ id: "m", name: "m", email: "m@x.de", role: "MEMBER" }, { id: "a", name: "a", email: "a@x.de", role: "ADMIN" }, { id: "mo", name: "mo", email: "mo@x.de", role: "MODERATOR" }] });
    await db.player.create({ data: { id: 1, name: "p", tribe: 1, allianceId: 36, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() } });
    await db.playerLink.create({ data: { userId: "m", travianPlayerId: 1, status: "verified", method: "invite" } });
    await db.allianceClassification.create({ data: { allianceId: 36, relation: "OWN" } });
    await db.channel.create({ data: { tree: "ALLY", name: "Chat", slug: "chat" } });
    await db.setting.createMany({ data: [{ key: "allianceId", value: "36" }, { key: "worldEndedAt", value: "x" }, { key: "staleDays", value: "3" }] });
    expect(await startNewWorld(db)).toEqual({ guestsDemoted: 1 });
    expect(await db.player.count()).toBe(0);
    expect(await db.playerLink.count()).toBe(0);
    expect(await db.allianceClassification.count()).toBe(0);
    expect((await db.user.findMany({ orderBy: { id: "asc" } })).map((u) => [u.id, u.role])).toEqual([["a", "ADMIN"], ["m", "GUEST"], ["mo", "MODERATOR"]]);
    expect(await db.channel.count()).toBe(1);
    expect((await db.setting.findMany()).map((s) => s.key)).toEqual(["staleDays"]);
    expect(await db.auditLog.count({ where: { action: "world.reset" } })).toBe(1);
  });
});
