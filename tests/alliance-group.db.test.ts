import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearRelation, loadGroupPlayers, loadRelations, ownGroupIds, setRelation } from "@/lib/alliance-group";

const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL! } } });

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "AllianceClassification","Player","Setting" RESTART IDENTITY CASCADE`;
  const base = { tribe: 1, population: 10, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() };
  await db.player.createMany({
    data: [
      { id: 1, name: "a", allianceId: 36, ...base },
      { id: 2, name: "b", allianceId: 7, ...base },
      { id: 3, name: "c", allianceId: 9, ...base },
    ],
  });
});
afterAll(() => db.$disconnect());

describe("Allianz-Gruppe (DB)", () => {
  it("Setting + Klassifizierung ergeben die Gruppe; Mitglieder aus allen Gruppenallianzen", async () => {
    await db.setting.create({ data: { key: "allianceId", value: "36" } });
    await setRelation(db, 7, "ALLIED", { updatedBy: "u1" });
    await setRelation(db, 9, "NAP");
    expect(ownGroupIds(await loadRelations(db))).toEqual(new Set([36, 7]));
    expect((await loadGroupPlayers(db)).map((p) => p.id)).toEqual([1, 2]);
    await clearRelation(db, 7);
    expect((await loadGroupPlayers(db)).map((p) => p.id)).toEqual([1]);
  });
  it("lehnt ungültige Eingaben ab", async () => {
    await expect(setRelation(db, 0, "OWN")).rejects.toThrow();
    await expect(setRelation(db, 5, "BOGUS" as "OWN")).rejects.toThrow();
  });
});
