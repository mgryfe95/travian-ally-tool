import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyReading } from "@/lib/ai/apply";
import { setAiClient, StubAiClient } from "@/lib/ai/client";
import { VisionPipeline } from "@/lib/ai/pipeline";
import { readingSchema, type Reading } from "@/lib/ai/reading";
import { storage } from "@/lib/storage";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const dir = join(__dirname, "fixtures/screenshots");
const gold = (n: string) => readingSchema.parse(JSON.parse(readFileSync(join(dir, `${n}.gold.json`), "utf8")));
const known = [
  { id: 9001, name: "MG Ryfe", x: -3, y: -82 },
  { id: 9002, name: "OG Ryfe", x: -7, y: -82 },
  { id: 9003, name: "MG", x: -3, y: -83 },
  { id: 9004, name: "OG", x: -4, y: -81 },
];

class FakeClient extends StubAiClient {
  calls = 0;
  constructor(private readonly reading: Reading) { super(); }
  override async read() { this.calls++; return structuredClone(this.reading); }
}

beforeAll(async () => {
  await db.$connect();
});
afterAll(async () => db.$disconnect());
beforeEach(async () => {
  await db.screenshot.deleteMany();
  await db.visionExample.deleteMany();
  await db.villageState.deleteMany({ where: { villageId: { in: known.map((k) => k.id) } } });
});

describe("applyReading", () => {
  it("Truppen je Dorf (Eigene Truppen, Desktop) und Rohstoffe je Dorf (mobil)", async () => {
    await applyReading(db, "vis-user", 1, gold("stats-troops-own-desktop-de"), known);
    const s = await db.villageState.findUnique({ where: { villageId: 9001 } });
    expect((s?.troops as { unit: string; inVillage: number }[]).find((t) => t.unit === "Einheit 1")?.inVillage).toBe(700);
    expect((s?.troops as { unit: string }[]).some((t) => t.unit === "Held")).toBe(true);
    await applyReading(db, "vis-user", 2, gold("stats-resources-mobile-en"), known);
    const r = await db.villageState.findUnique({ where: { villageId: 9003 } });
    expect((r?.resources as { stock: { crop: number }; production: { crop: number } }).stock.crop).toBe(12535);
    expect((r?.resources as { production: { crop: number } }).production.crop).toBe(-2334);
  });
  it("fremde Dörfer werden nie geschrieben", async () => {
    const applied = await applyReading(db, "vis-user", 3, gold("stats-troops-own-desktop-de"), [known[0]!]);
    expect(applied.map((a) => a.villageId)).toEqual([9001]);
  });
});

describe("Lernmodus", () => {
  it("ohne Key bleibt der Screenshot hochgeladen; mit Lesung: Prüfung, Bestätigung speichert Beispiel", async () => {
    await storage().put("shots/vis-user/a.png", readFileSync(join(dir, "stats-hospital-mobile-en.png")));
    const shot = await db.screenshot.create({ data: { userId: "vis-user", storageKey: "shots/vis-user/a.png" } });
    setAiClient(new StubAiClient());
    expect((await new VisionPipeline(db).process(shot.id)).status).toBe("uploaded");

    const fake = new FakeClient(gold("stats-hospital-mobile-en"));
    setAiClient(fake);
    const res = await new VisionPipeline(db).process(shot.id);
    expect(res.status).toBe("needs_review"); // Lernmodus: noch keine bestätigten Beispiele
    expect(fake.calls).toBeGreaterThanOrEqual(1);
    expect((await db.screenshot.findUnique({ where: { id: shot.id } }))?.detectedKind).toBe("VILLAGE_HOSPITAL");

    // Konto mit den vier Dörfern des Musters verknüpfen, sonst kann nichts übernommen werden
    await db.$executeRaw`TRUNCATE "User","Player","Village","PlayerLink" RESTART IDENTITY CASCADE`;
    await db.user.create({ data: { id: "vis-user", name: "V", email: "vis@x.de", role: "MEMBER" } });
    await db.player.create({ data: { id: 7, name: "MG.RYFE", allianceId: 36, tribe: 1, population: 10, villageCount: 4, status: "active", noGrowthDays: 0, firstSeen: new Date() } });
    await db.village.createMany({ data: known.map((k) => ({ id: k.id, fieldId: k.id, x: k.x, y: k.y, name: k.name, playerId: 7, population: 1, extra: {} })) });
    await db.playerLink.create({ data: { userId: "vis-user", travianPlayerId: 7, status: "verified", method: "admin" } });
    expect((await new VisionPipeline(db).confirm(shot.id, "vis-user")).status).toBe("parsed");
    expect(await db.visionExample.count({ where: { kind: "VILLAGE_HOSPITAL" } })).toBe(1);
    expect((await new VisionPipeline(db).confirm(shot.id, "anderer")).status).toBe("failed");
    setAiClient(undefined);
  });
});

describe("Bestätigen: Dorfzuordnung", () => {
  it("ohne zuordenbares Dorf kommt ein Fehler; mit Link werden Gebäude geschrieben; gewähltes Dorf schlägt die Erkennung", async () => {
    await db.$executeRaw`TRUNCATE "User","Player","Village","PlayerLink" RESTART IDENTITY CASCADE`;
    await db.user.create({ data: { id: "vu", name: "V", email: "vu@x.de", role: "MEMBER" } });
    const base = { tribe: 1, population: 10, villageCount: 2, status: "active", noGrowthDays: 0, firstSeen: new Date() };
    await db.player.create({ data: { id: 7, name: "MG.RYFE", allianceId: 36, ...base } });
    await db.village.createMany({ data: [{ id: 9001, fieldId: 1, x: -3, y: -82, name: "MG Ryfe", playerId: 7, population: 1, extra: {} }, { id: 9003, fieldId: 2, x: -3, y: -83, name: "MG", playerId: 7, population: 1, extra: {} }] });
    await storage().put("shots/vu/b.webp", readFileSync(join(dir, "village-view-mobile-en.png")));
    const shot = await db.screenshot.create({ data: { userId: "vu", storageKey: "shots/vu/b.webp" } });
    await db.screenshot.update({ where: { id: shot.id }, data: { parsed: { reading: gold("village-view-mobile-en") } } });
    const p = new VisionPipeline(db);
    const r1 = await p.confirm(shot.id, "vu");
    expect(r1.status).toBe("failed"); // Konto noch nicht mit dem Spieler verknüpft
    expect(r1.reason).toContain("keinem deiner Dörfer");
    await db.playerLink.create({ data: { userId: "vu", travianPlayerId: 7, status: "verified", method: "admin" } });
    expect((await p.confirm(shot.id, "vu")).status).toBe("parsed");
    expect(((await db.villageState.findUniqueOrThrow({ where: { villageId: 9001 } })).buildings as unknown[]).length).toBe(20);
    // ausdrücklich gewähltes Dorf (MG) schlägt die erkannte Dorfzeile (MG Ryfe)
    expect((await p.confirm(shot.id, "vu", undefined, 9003)).status).toBe("parsed");
    expect(((await db.villageState.findUniqueOrThrow({ where: { villageId: 9003 } })).buildings as unknown[]).length).toBe(20);
  });
});
