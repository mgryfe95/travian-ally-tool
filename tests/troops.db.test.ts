import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/permissions";
import { seedPermissions } from "@/lib/services/admin";
import { saveTroops, troopsOverview } from "@/lib/services/troops";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const t0 = new Date("2026-10-14T10:00:00Z");
const base = { tribe: 1, population: 10, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: t0 };

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","RolePermission","AuditLog","Setting","Player","Village","PlayerLink","VillageState","AllianceClassification" RESTART IDENTITY CASCADE`;
  await seedPermissions(db);
  await db.setting.create({ data: { key: "allianceId", value: "36" } });
  await db.allianceClassification.create({ data: { allianceId: 7, relation: "ALLIED" } });
  await db.user.createMany({ data: ["u1", "u2", "u3", "mod", "mem"].map((id) => ({ id, name: id, email: `${id}@x.de`, role: id === "mod" ? "MODERATOR" : "MEMBER" })) });
  await db.player.createMany({
    data: [
      { id: 1, name: "Alpha", allianceId: 36, ...base }, { id: 2, name: "Beta", allianceId: 7, ...base }, // verbündet = Gruppe
      { id: 3, name: "Gamma", allianceId: 9, ...base }, // fremd
      { id: 4, name: "Delta", allianceId: 36, ...base }, // ohne Konto
    ],
  });
  await db.village.createMany({
    data: [
      { id: 10, fieldId: 1, x: 0, y: 0, name: "A1", playerId: 1, population: 100, extra: {} }, { id: 11, fieldId: 2, x: 1, y: 1, name: "A2", playerId: 1, population: 50, extra: {} },
      { id: 20, fieldId: 3, x: 2, y: 2, name: "B1", playerId: 2, population: 80, extra: {} }, { id: 30, fieldId: 4, x: 3, y: 3, name: "G1", playerId: 3, population: 80, extra: {} },
    ],
  });
  for (const [userId, travianPlayerId] of [["u1", 1], ["u2", 2], ["u3", 3]] as const) await db.playerLink.create({ data: { userId, travianPlayerId, status: "verified", method: "invite" } });
});
afterAll(() => db.$disconnect());

const mod = { id: "mod", role: "MODERATOR" as const };

describe("Truppenübersicht für Admins/Moderatoren", () => {
  it("Moderator sieht Mitglieder der Gruppe (auch verbündete Allianz) mit Summen; Fremde und Mitglieder ohne Konto fehlen", async () => {
    await saveTroops(db, "u1", 10, [{ unit: "Axt", inVillage: 100, away: 10, support: 0 }], new Date(t0.getTime() - 3 * 86_400_000));
    await saveTroops(db, "u1", 11, [{ unit: "Axt", inVillage: 50, away: 0, support: 5 }, { unit: "Ram", inVillage: 20, away: 0, support: 0 }], t0);
    await saveTroops(db, "u2", 20, [{ unit: "Axt", inVillage: 1000, away: 0, support: 0 }], t0);
    await saveTroops(db, "u3", 30, [{ unit: "Axt", inVillage: 999999, away: 0, support: 0 }], t0);
    const o = await troopsOverview(db, mod, t0);
    expect(o.members.map((m) => m.playerName)).toEqual(["Alpha", "Beta"]);
    expect(o.members[0]).toMatchObject({ playerName: "Alpha", accounts: ["u1"], oldestAgeDays: 3 });
    expect(o.members[0]?.totals.find((t) => t.unit === "Axt")).toMatchObject({ inVillage: 150, away: 10, support: 5, total: 160 });
    expect(o.totals.find((t) => t.unit === "Axt")?.total).toBe(1160);
    expect(o.membersWithoutAccount).toBe(1);
    expect(o.membersWithoutData).toBe(0);
    expect(await db.auditLog.count({ where: { action: "troops.view", actorId: "mod" } })).toBe(1);
  });
  it("Mitglied ohne Recht, Gast und fehlendes Recht → 403; Admin und Systemadmin dürfen", async () => {
    await expect(troopsOverview(db, { id: "mem", role: "MEMBER" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(troopsOverview(db, { id: "x", role: "GUEST" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(troopsOverview(db, { id: "a", role: "ADMIN" })).resolves.toBeTruthy();
    await expect(troopsOverview(db, { id: "s", role: "ADMIN" })).resolves.toBeTruthy();
    await db.rolePermission.deleteMany({ where: { role: "MODERATOR", permission: "troops.view" } });
    await expect(troopsOverview(db, mod)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("Dörfer ohne Eingabe zählen als „keine Daten“", async () => {
    const o = await troopsOverview(db, mod, t0);
    expect(o.membersWithoutData).toBe(2);
    expect(o.members[0]?.villages.every((v) => v.troopsAt === null)).toBe(true);
  });
});

describe("Eingabe", () => {
  it("nur für eigene Dörfer; setzt nur den Bereich Truppen", async () => {
    await expect(saveTroops(db, "u1", 20, [])).rejects.toBeInstanceOf(ForbiddenError);
    await db.villageState.create({ data: { villageId: 10, userId: "u1", resources: { stock: 1 }, resourcesAt: t0 } });
    await saveTroops(db, "u1", 10, [{ unit: "Axt", inVillage: 1, away: 0, support: 0 }], t0);
    const s = await db.villageState.findUniqueOrThrow({ where: { villageId: 10 } });
    expect(s.resourcesAt).toEqual(t0);
    expect(s.resources).toEqual({ stock: 1 });
    expect(s.troopsAt).toEqual(t0);
  });
});
