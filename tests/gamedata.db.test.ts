import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GameDataError, importGameData as rawImport } from "@/lib/gamedata/import";
import { worldProfile } from "@/lib/world-profile";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });

const WORLD = worldProfile("https://ts12.x1.europe.travian.com");
const importGameData = (d: PrismaClient, raw: unknown, w = WORLD) => rawImport(d, raw, w);

// Synthetische Teststruktur – keine Spielwerte.
const lvl = (level: number) => ({ level, costWood: 1, costClay: 2, costIron: 3, costCrop: 4, upkeep: 1, buildTimeSec: 600 * level, culturePoints: 1, effects: { demo: level } });
const valid = () => ({
  source: "https://example.invalid/test (abgerufen 2026-01-01)",
  world: { host: "ts12.x1.europe.travian.com", gameVersion: "legends" },
  serverSpeed: 1,
  tribes: [{ key: "t1", name: "Volk 1" }],
  buildings: [{ key: "b1", name: "Gebäude 1", category: "infrastructure", maxLevel: 3, levels: [lvl(1), lvl(2), lvl(3)] }],
  units: [{ tribe: "t1", key: "u1", name: "Einheit 1", attack: 1, defInf: 1, defCav: 1, speed: 1, carry: 1, costWood: 1, costClay: 1, costIron: 1, costCrop: 1, upkeep: 1, trainTimeSec: 1, building: "b1" }],
});

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "GameDataVersion" RESTART IDENTITY CASCADE`;
});
afterAll(() => db.$disconnect());

describe("importGameData", () => {
  it("legt Version, Völker, Gebäude, Stufen und Einheiten an; neuer Import = neue Version", async () => {
    const r = await importGameData(db, valid());
    expect(r).toMatchObject({ tribes: 1, buildings: 1, levels: 3, units: 1 });
    await importGameData(db, valid());
    expect(await db.gameDataVersion.count()).toBe(2);
    expect(await db.unit.count()).toBe(2);
  });
  it("lehnt fehlerhafte Dateien komplett ab (nichts wird geschrieben)", async () => {
    const bad = valid();
    bad.buildings[0]!.levels = [lvl(1), lvl(3)];
    await expect(importGameData(db, bad)).rejects.toBeInstanceOf(GameDataError);
    const bad2 = valid();
    bad2.units[0]!.tribe = "unbekannt";
    await expect(importGameData(db, bad2)).rejects.toThrow(/unknown tribe/);
    await expect(importGameData(db, { ...valid(), source: "x" })).rejects.toThrow(/source/);
    await expect(importGameData(db, { ...valid(), buildings: [{ ...valid().buildings[0]!, costWood: -1 }, { ...valid().buildings[0]!, levels: [{ ...lvl(1), costWood: -5 }] }] })).rejects.toBeInstanceOf(GameDataError);
    expect(await db.gameDataVersion.count()).toBe(0);
  });
  it("doppelte Keys werden abgelehnt", async () => {
    const d = valid();
    d.buildings.push(d.buildings[0]!);
    await expect(importGameData(db, d)).rejects.toThrow(/Duplicate/);
  });
});

describe("Vertrags-Invariante: nur Werte der eigenen Welt", () => {
  it("lehnt andere Welt, andere Version und andere Geschwindigkeit ab – ohne etwas zu schreiben", async () => {
    await expect(importGameData(db, { ...valid(), world: { host: "ts5.x3.europe.travian.com", gameVersion: "legends" } })).rejects.toThrow(/game world/);
    await expect(importGameData(db, { ...valid(), world: { host: "ts12.x1.europe.travian.com", gameVersion: "kingdoms" } })).rejects.toThrow(/Game version/);
    await expect(importGameData(db, { ...valid(), serverSpeed: 3 })).rejects.toThrow(/speed/);
    await expect(importGameData(db, { ...valid(), serverSpeed: undefined })).rejects.toBeInstanceOf(GameDataError); // Geschwindigkeit muss angegeben sein
    await expect(importGameData(db, { ...valid(), world: undefined })).rejects.toBeInstanceOf(GameDataError);
    expect(await db.gameDataVersion.count()).toBe(0);
  });
  it("Host ohne Geschwindigkeit braucht GAME_SPEED; passende Datei wird mit Welt/Version gespeichert", async () => {
    await expect(importGameData(db, valid(), worldProfile("https://ts9.europe.travian.com"))).rejects.toThrow(/GAME_SPEED|world/);
    const w = worldProfile("https://ts12.x1.europe.travian.com", { version: "Legends" });
    await importGameData(db, valid(), w);
    expect(await db.gameDataVersion.findFirstOrThrow()).toMatchObject({ worldHost: "ts12.x1.europe.travian.com", gameVersion: "legends", serverSpeed: 1 });
  });
});

