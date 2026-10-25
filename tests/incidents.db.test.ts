import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Advisor } from "@/lib/ai/advice";
import { buildSituation } from "@/lib/ai/situation";
import { adviceStatus, runAdvice, setAdvisor } from "@/lib/services/advice";
import { seedChat } from "@/lib/services/chat";
import { createIncident, draftFromScreenshot, getIncident, listIncidents, requestHelp, resolveIncident } from "@/lib/services/incidents";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const member = { id: "u1", role: "MEMBER" as const };
const answers = { moreAttacks: "yes" as const, ongoing: "no" as const, needHelp: "yes" as const };
let seen: { focus?: number; incidents: number }[] = [];
const fake: Advisor = { async advise(s, o) { seen.push({ focus: o.focusIncident, incidents: s.incidents.length }); return { summary: "s", recommendations: [] }; } };

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Village","Player","Alliance","Setting","VillageState","AdviceRun","Recommendation","AiUsage","RolePermission","Incident","Channel","Message","UnitName","Screenshot","MemoryDoc" RESTART IDENTITY CASCADE`;
  await db.user.createMany({ data: [{ id: "u1", name: "u1", email: "u1@x.de", role: "MEMBER" }, { id: "u2", name: "u2", email: "u2@x.de", role: "MEMBER" }] });
  await db.player.createMany({ data: [
    { id: 1, name: "Me", tribe: 2, allianceId: 0, population: 100, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() },
    { id: 9, name: "Evil", tribe: 1, allianceId: 77, population: 800, villageCount: 4, status: "active", noGrowthDays: 0, firstSeen: new Date() },
  ] });
  await db.alliance.create({ data: { id: 77, name: "BAD", memberCount: 1, villageCount: 4, population: 800 } });
  await db.village.createMany({ data: [{ id: 10, fieldId: 1, x: 0, y: 0, name: "Home", playerId: 1, population: 100, extra: {} }, { id: 90, fieldId: 2, x: 3, y: 4, name: "Evil Town", playerId: 9, population: 200, extra: {} }] });
  await db.playerLink.create({ data: { userId: "u1", travianPlayerId: 1, status: "verified", method: "invite" } });
  await db.unitName.createMany({ data: [{ tribeVid: 2, slot: 1, nameEn: "Clubswinger", nameDe: "Keulenschwinger", gameVersion: "t", source: "t" }, { tribeVid: 2, slot: 2, nameEn: "Spearman", nameDe: "Speerkämpfer", gameVersion: "t", source: "t" }] });
  await db.villageState.create({ data: { villageId: 10, userId: "u1", troops: [{ unit: "Keulenschwinger", inVillage: 100, away: 0, support: 0 }, { unit: "Speerkämpfer", inVillage: 5, away: 0, support: 0 }] } });
  await seedChat(db);
  seen = [];
  setAdvisor(fake);
});
afterAll(async () => { setAdvisor(undefined); await db.$disconnect(); });

describe("Incidents", () => {
  it("anlegen per Koordinaten: Angreifer aus der map.sql, Verluste benannt, Truppen korrigiert, Bedrohung 3 Tage", async () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const i = await createIncident(db, member, { villageId: 10, kind: "raid", attacker: "(3|4)", answers, defenderLosses: [30, 9], correctTroops: true }, "de", now);
    expect(i).toMatchObject({ attackerName: "Evil", attackerPlayerId: 9, attackerAlliance: "BAD", kind: "raid" });
    expect(i.defenderLosses).toEqual([{ unit: "Keulenschwinger", count: 30 }, { unit: "Speerkämpfer", count: 9 }]);
    expect(i.threatUntil.toISOString()).toBe("2026-10-28T12:00:00.000Z");
    const st = await db.villageState.findUnique({ where: { villageId: 10 } });
    expect(st?.troops).toEqual([{ unit: "Keulenschwinger", inVillage: 70, away: 0, support: 0 }, { unit: "Speerkämpfer", inVillage: 0, away: 0, support: 0 }]);
    expect((await db.incident.findUnique({ where: { id: i.id } }))?.troopsCorrected).toBe(true);
  });
  it("nur eigene Dörfer, nur mit Recht; fremde Incidents unsichtbar außer mit incidents.view", async () => {
    await expect(createIncident(db, member, { villageId: 90, kind: "attack", attacker: "Evil", answers }, "de")).rejects.toThrow();
    await expect(createIncident(db, { id: "u1", role: "GUEST" }, { villageId: 10, kind: "attack", attacker: "Evil", answers }, "de")).rejects.toThrow();
    const i = await createIncident(db, member, { villageId: 10, kind: "attack", attacker: "evil", answers }, "de");
    expect(i.attackerPlayerId).toBe(9);
    expect(await getIncident(db, { id: "u2", role: "MEMBER" }, i.id)).toBeNull();
    expect(await listIncidents(db, { id: "u2", role: "MEMBER" }, { all: true })).toEqual([]);
    expect((await listIncidents(db, { id: "u2", role: "ADMIN" }, { all: true })).length).toBe(1);
    await expect(resolveIncident(db, { id: "u2", role: "ADMIN" }, i.id)).rejects.toThrow();
  });
  it("Hilfe im Deff-Call: Nachricht einmal, englisch", async () => {
    const i = await createIncident(db, member, { villageId: 10, kind: "attack", attacker: "Evil", answers }, "de");
    await requestHelp(db, member, i.id);
    const msg = await db.message.findFirst({ orderBy: { id: "desc" } });
    expect(msg?.body).toMatch(/Defence needed.*Home/);
    await expect(requestHelp(db, member, i.id)).rejects.toThrow();
  });
  it("Lagebewertung: einmal je Incident, zusätzlich zum Tageslauf; Incident im Lagebild", async () => {
    const i = await createIncident(db, member, { villageId: 10, kind: "attack", attacker: "Evil", answers }, "de");
    expect((await buildSituation(db, "u1")).incidents[0]?.attacker).toMatchObject({ name: "Evil", population: 800, nearestVillageFields: 5 });
    await runAdvice(db, member, "de");
    await runAdvice(db, member, "de", new Date(), i.id);
    expect(seen).toEqual([{ focus: undefined, incidents: 1 }, { focus: i.id, incidents: 1 }]);
    expect((await adviceStatus(db, member, new Date(), i.id)).reason).toBe("incidentDone");
    expect((await adviceStatus(db, member)).reason).toBe("daily");
    expect(await db.aiUsage.count()).toBe(0); // Fake meldet keine Nutzung
  });
  it("Entwurf nur aus eigenem Kampfbericht-Screenshot", async () => {
    const reading = { kind: "BATTLE_REPORT", device: "DESKTOP", language: "de", village: null, topBar: null, totals: null, fields: [], buildings: [], selfRating: 0.8, uncertain: [],
      rows: [{ name: "info", x: null, y: null, current: false, cells: [], texts: ["Evil", "", "BAD", "Me", "Home", "", "attack"] }, { name: "attacker_units", x: 3, y: 4, current: false, cells: [10], texts: [] }, { name: "defender_units", x: 0, y: 0, current: false, cells: [5], texts: [] }] };
    const shot = await db.screenshot.create({ data: { userId: "u1", storageKey: "k", parsed: { reading } } });
    expect((await draftFromScreenshot(db, "u1", shot.id))?.villageId).toBe(10);
    expect(await draftFromScreenshot(db, "u2", shot.id)).toBeNull();
  });

  it("Gedächtnis: früherer Incident desselben Angreifers steht im Lagebild, Suche nur eigene", async () => {
    const first = await createIncident(db, member, { villageId: 10, kind: "raid", attacker: "Evil", answers, notes: "wall 5" }, "de");
    await resolveIncident(db, member, first.id);
    await createIncident(db, member, { villageId: 10, kind: "attack", attacker: "Evil", answers }, "de");
    const s = await buildSituation(db, "u1");
    expect(s.incidents).toHaveLength(1);
    expect(s.memory.map((m) => m.title)).toEqual(["raid on Home by Evil [BAD]"]);
    expect((await buildSituation(db, "u2")).memory).toEqual([]);
  });
});
