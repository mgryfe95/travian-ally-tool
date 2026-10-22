import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/permissions";
import { getOwnVillage, getStaleDays, getVillageInstructions, ownVillages, saveAccountInstructions, saveBuildings, saveVillageInstructions, VillageError } from "@/lib/services/villages";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Village","Setting","VillageProfile","VillageState" RESTART IDENTITY CASCADE`;
  await db.user.createMany({ data: [{ id: "u1", name: "u1", email: "u1@x.de" }, { id: "u2", name: "u2", email: "u2@x.de" }] });
  await db.village.createMany({
    data: [{ id: 10, fieldId: 1, x: 0, y: 0, name: "A", playerId: 1, population: 50, extra: {} }, { id: 11, fieldId: 2, x: 1, y: 1, name: "B", playerId: 1, population: 90, extra: {} }, { id: 20, fieldId: 3, x: 2, y: 2, name: "C", playerId: 2, population: 10, extra: {} }],
  });
  await db.playerLink.create({ data: { userId: "u1", travianPlayerId: 1, status: "verified", method: "invite" } });
  await db.playerLink.create({ data: { userId: "u2", travianPlayerId: 2, status: "pending", method: "village_rename" } });
});
afterAll(() => db.$disconnect());

describe("Meine Dörfer", () => {
  it("nur Dörfer verifizierter Spieler, größtes zuerst; pending zählt nicht", async () => {
    expect((await ownVillages(db, "u1")).map((v) => v.id)).toEqual([11, 10]);
    expect(await ownVillages(db, "u2")).toEqual([]);
  });
  it("fremdes Dorf ist nicht abrufbar", async () => {
    expect(await getOwnVillage(db, "u1", 20)).toBeNull();
    expect((await getOwnVillage(db, "u1", 10))?.name).toBe("A");
  });
});

describe("KI-Instruktionen", () => {
  it("Account- und Dorfebene werden gespeichert; fremde Dörfer → 403; Länge begrenzt", async () => {
    await saveAccountInstructions(db, "u1", "  Off-Account \r\n");
    expect((await db.user.findUnique({ where: { id: "u1" } }))?.aiInstructions).toBe("Off-Account");
    await saveVillageInstructions(db, "u1", 11, "Hammerdorf");
    expect(await getVillageInstructions(db, "u1", 11)).toBe("Hammerdorf");
    await expect(saveVillageInstructions(db, "u1", 20, "x")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveVillageInstructions(db, "u2", 20, "x")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveAccountInstructions(db, "u1", "x".repeat(4001))).rejects.toBeInstanceOf(VillageError);
  });
  it("Schwelle für veraltete Daten: Default 2, per Setting änderbar", async () => {
    expect(await getStaleDays(db)).toBe(2);
    await db.setting.create({ data: { key: "staleDays", value: "5" } });
    expect(await getStaleDays(db)).toBe(5);
  });
});

describe("Gebäude von Hand korrigieren", () => {
  it("speichert Name/Stufe je Platz im eigenen Dorf; fremde Dörfer und ungültige Werte werden abgelehnt", async () => {
    await saveBuildings(db, "u1", 10, [{ slot: 19, name: " Hauptgebäude ", level: 12 }, { slot: null, name: null, level: 3 }]);
    const st = await db.villageState.findUniqueOrThrow({ where: { villageId: 10 } });
    expect(st.buildings).toEqual([{ slot: 19, name: "Hauptgebäude", level: 12 }, { slot: null, name: null, level: 3 }]);
    expect(st.buildingsAt).not.toBeNull();
    await expect(saveBuildings(db, "u1", 20, [{ slot: 1, name: "x", level: 1 }])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveBuildings(db, "u1", 10, [{ slot: 99, name: "x", level: 1 }])).rejects.toBeInstanceOf(VillageError);
    await expect(saveBuildings(db, "u1", 10, [{ slot: 1, name: "x", level: 31 }])).rejects.toBeInstanceOf(VillageError);
  });
});
