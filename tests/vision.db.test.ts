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

    expect((await new VisionPipeline(db).confirm(shot.id, "vis-user")).status).toBe("parsed");
    expect(await db.visionExample.count({ where: { kind: "VILLAGE_HOSPITAL" } })).toBe(1);
    expect((await new VisionPipeline(db).confirm(shot.id, "anderer")).status).toBe("failed");
    setAiClient(undefined);
  });
});
