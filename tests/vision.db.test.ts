import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyReading, inheritNames } from "@/lib/ai/apply";
import { setAiClient, StubAiClient } from "@/lib/ai/client";
import { VisionPipeline } from "@/lib/ai/pipeline";
import { readingSchema, type Reading } from "@/lib/ai/reading";
import { releaseScreenshotFiles } from "@/lib/screenshots";
import { screenshotStorage, storage } from "@/lib/storage";

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
  it("Einheitennamen: Slot → Name über das Volk des Spielers (map.sql), Held und fehlende Plätze bleiben", async () => {
    await db.$executeRaw`TRUNCATE "Player","Village","UnitName" RESTART IDENTITY CASCADE`;
    await db.player.create({ data: { id: 7, name: "P", allianceId: 36, tribe: 3, population: 1, villageCount: 1, status: "active", noGrowthDays: 0, firstSeen: new Date() } });
    await db.village.create({ data: { id: 9001, fieldId: 1, x: -3, y: -82, name: "MG Ryfe", playerId: 7, population: 1, extra: {} } });
    await db.unitName.createMany({ data: [{ tribeVid: 3, slot: 1, nameEn: "Phalanx", nameDe: "Phalanx", gameVersion: "legends", source: "t" }, { tribeVid: 3, slot: 3, nameEn: "Pathfinder", nameDe: "Späher", gameVersion: "legends", source: "t" }, { tribeVid: 1, slot: 1, nameEn: "Legionnaire", gameVersion: "legends", source: "t" }] });
    await applyReading(db, "vis-user", 5, gold("stats-troops-own-desktop-de"), known);
    const t = (await db.villageState.findUniqueOrThrow({ where: { villageId: 9001 } })).troops as { unit: string; inVillage: number }[];
    expect(t.find((x) => x.unit === "Phalanx")?.inVillage).toBe(700); // Platz 1, Volk 3 (Gallier)
    expect(t.find((x) => x.unit === "Späher")?.inVillage).toBe(24); // Platz 3 deutscher Name
    expect(t.some((x) => x.unit === "Einheit 5")).toBe(true); // kein Name hinterlegt
    expect(t.some((x) => x.unit === "Held")).toBe(true);
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
    expect(r1.reasonKey).toBe("err.vision.noVillageMatch");
    expect(r1.reason).toContain("any of your villages");
    await db.playerLink.create({ data: { userId: "vu", travianPlayerId: 7, status: "verified", method: "admin" } });
    expect((await p.confirm(shot.id, "vu")).status).toBe("parsed");
    expect(((await db.villageState.findUniqueOrThrow({ where: { villageId: 9001 } })).buildings as unknown[]).length).toBe(20);
    // ausdrücklich gewähltes Dorf (MG) schlägt die erkannte Dorfzeile (MG Ryfe)
    expect((await p.confirm(shot.id, "vu", undefined, 9003)).status).toBe("parsed");
    expect(((await db.villageState.findUniqueOrThrow({ where: { villageId: 9003 } })).buildings as unknown[]).length).toBe(20);
  });
});

describe("Bild nach Auswertung freigeben", () => {
  it("löscht Datei und Größe, behält die Auswertung; Lern-Beispiele bleiben erhalten", async () => {
    await screenshotStorage().put("shots/rel/a.webp", Buffer.from("x"));
    await screenshotStorage().put("shots/rel/b.webp", Buffer.from("y"));
    const a = await db.screenshot.create({ data: { userId: "rel", storageKey: "shots/rel/a.webp", sizeBytes: 5, status: "parsed" } });
    const b = await db.screenshot.create({ data: { userId: "rel", storageKey: "shots/rel/b.webp", sizeBytes: 5, status: "parsed" } });
    await db.visionExample.create({ data: { kind: "VILLAGE_HOSPITAL", storageKey: "shots/rel/b.webp", gold: {}, createdBy: "rel" } });
    expect(await releaseScreenshotFiles(db, ["shots/rel/a.webp", "shots/rel/b.webp"])).toBe(1);
    expect(await db.screenshot.findUnique({ where: { id: a.id } })).toMatchObject({ sizeBytes: 0, status: "parsed" });
    expect((await db.screenshot.findUnique({ where: { id: a.id } }))?.removedAt).not.toBeNull();
    expect((await db.screenshot.findUnique({ where: { id: b.id } }))?.removedAt).toBeNull();
    await expect(screenshotStorage().get("shots/rel/a.webp")).rejects.toBeTruthy();
    expect((await screenshotStorage().get("shots/rel/b.webp")).length).toBe(1);
    expect(await releaseScreenshotFiles(db, ["shots/rel/a.webp"])).toBe(0);
  });
});

describe("Namen je Platz übernehmen", () => {
  it("fehlende Namen kommen vom bisherigen Stand (gleicher Platz oder gleiche Reihenfolge)", () => {
    expect(inheritNames([{ slot: 19, name: null, level: 5 }, { slot: 20, name: "Lager", level: 2 }], [{ slot: 19, name: "Hauptgebäude", level: 4 }])).toEqual([{ slot: 19, name: "Hauptgebäude", level: 5 }, { slot: 20, name: "Lager", level: 2 }]);
    expect(inheritNames([{ slot: null, name: null, level: 5 }, { slot: null, name: null, level: 1 }], [{ slot: null, name: "A", level: 4 }, { slot: null, name: "B", level: 1 }]).map((b) => b.name)).toEqual(["A", "B"]);
    expect(inheritNames([{ slot: null, name: null, level: 5 }], [{ slot: null, name: "A", level: 4 }, { slot: null, name: "B", level: 1 }])[0]!.name).toBeNull();
  });
});

describe("Bestätigung zurücknehmen", () => {
  it("entfernt das Lern-Beispiel und stellt den Screenshot wieder zur Prüfung; nur eigene, bestätigte", async () => {
    await storage().put("shots/rt/a.webp", Buffer.from("x"));
    const shot = await db.screenshot.create({ data: { userId: "rt", storageKey: "shots/rt/a.webp", status: "parsed", parsed: { reading: gold("stats-hospital-mobile-en"), confirmedBy: "rt", applied: [] } } });
    await db.visionExample.create({ data: { kind: "VILLAGE_HOSPITAL", storageKey: "shots/rt/a.webp", gold: {}, createdBy: "rt" } });
    const p = new VisionPipeline(db);
    expect((await p.retract(shot.id, "fremd")).status).toBe("failed");
    expect((await p.retract(shot.id, "rt")).status).toBe("needs_review");
    expect(await db.visionExample.count({ where: { storageKey: "shots/rt/a.webp" } })).toBe(0);
    const after = await db.screenshot.findUniqueOrThrow({ where: { id: shot.id } });
    expect(after.status).toBe("needs_review");
    expect((after.parsed as { confirmedBy?: string; reading?: unknown }).confirmedBy).toBeUndefined();
    expect((after.parsed as { reading?: unknown }).reading).toBeTruthy();
    expect((await p.retract(shot.id, "rt")).status).toBe("failed"); // nicht mehr bestätigt
  });
});
