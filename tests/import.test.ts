import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { importMapSql, pruneVillageSnapshots } from "@/lib/import/importer";

const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL! } } });
const fixture = readFileSync(new URL("./fixtures/map.sample.sql", import.meta.url), "utf8");

type V = [villageId: number, playerId: number, pop: number, allianceId?: number];
const sql = (vs: V[]) =>
  vs
    .map(([v, p, pop, a = 0]) => `INSERT INTO \`x_world\` VALUES (${v},${v % 400},${v % 300},1,${v},'v${v}',${p},'p${p}',${a},'${a ? "A" + a : ""}',${pop},NULL,TRUE,NULL,NULL,NULL);`)
    .join("\n");
const day = (n: number) => new Date(Date.UTC(2026, 9, 10 + n, 6));

async function wipe() {
  await db.$executeRaw`TRUNCATE "Snapshot","Player","Village","Alliance","PlayerDailyStat","Event" RESTART IDENTITY CASCADE`;
}

beforeEach(wipe);
afterAll(() => db.$disconnect());

describe("importMapSql", () => {
  it("importiert die echte Fixture und baut die aktuelle Sicht", async () => {
    const r = await importMapSql(db, fixture, { inactiveDays: 3, now: day(0) });
    expect(r).toMatchObject({ status: "imported", events: 0 });
    const rows = fixture.trim().split("\n").length;
    expect(await db.village.count()).toBe(rows);
    expect(await db.villageSnapshot.count()).toBe(rows);
    expect((await db.alliance.findUnique({ where: { id: 36 } }))?.name).toBe("Human");
    expect(await db.playerDailyStat.count()).toBe(await db.player.count());
  });

  it("überspringt unveränderten Hash", async () => {
    await importMapSql(db, fixture, { inactiveDays: 3, now: day(0) });
    expect(await importMapSql(db, fixture, { inactiveDays: 3, now: day(1) })).toEqual({ status: "unchanged" });
    expect(await db.snapshot.count()).toBe(1);
  });

  it("bricht bei leerem Input ab und lässt Daten unberührt", async () => {
    await importMapSql(db, fixture, { inactiveDays: 3, now: day(0) });
    const before = await db.village.count();
    await expect(importMapSql(db, "-- leer", { inactiveDays: 3, now: day(1) })).rejects.toThrow();
    expect(await db.village.count()).toBe(before);
  });

  it("4 Tage: Status, Deltas und Events", async () => {
    const d0: V[] = [[1, 1, 100, 5], [2, 2, 50], [3, 3, 80, 5]];
    const d1: V[] = [[1, 1, 110, 5], [2, 2, 50], [3, 3, 80, 5], [4, 1, 20, 5]]; // neues Dorf
    const d2: V[] = [[1, 1, 120, 5], [2, 2, 50], [3, 3, 80, 9], [4, 1, 20, 5]]; // Spieler 3 → Allianz 9
    const d3: V[] = [[1, 1, 130, 5], [2, 2, 50], [4, 3, 20, 9]]; // Dorf 3 verloren, Dorf 4 erobert
    for (const [i, vs] of [d0, d1, d2, d3].entries()) await importMapSql(db, sql(vs), { inactiveDays: 3, now: day(i) });

    const p = Object.fromEntries((await db.player.findMany()).map((x) => [x.id, x]));
    // Spieler 1: 100 → 130 → 140 → 130 (Dorf 4 an Spieler 3 verloren)
    expect(p[1]).toMatchObject({ status: "declining", population: 130, villageCount: 1, delta1: -10, delta3: 30 });
    expect(p[2]).toMatchObject({ status: "inactive", noGrowthDays: 3 });
    const types = (await db.event.findMany({ orderBy: { id: "asc" } })).map((e) => e.type);
    expect(types.slice(0, 2)).toEqual(["village_new", "alliance_change"]);
    expect(types.slice(2).sort()).toEqual(["village_conquered", "village_lost"]);
    expect(await db.playerDailyStat.count({ where: { playerId: 2 } })).toBe(4);
  });

  it("Pruning: nur die letzten 3 Snapshots behalten Dorfzeilen; Verlauf und Ereignisse bleiben", async () => {
    for (let i = 0; i < 5; i++) await importMapSql(db, sql([[1, 1, 100 + i, 5], [2, 2, 50, 5], ...(i >= 2 ? ([[3 + i, 3, 10]] as V[]) : [])]), { inactiveDays: 3, now: day(i) });
    const events = await db.event.count();
    expect(await pruneVillageSnapshots(db, 3)).toBeGreaterThan(0);
    const snaps = await db.villageSnapshot.groupBy({ by: ["snapshotId"] });
    expect(snaps.map((s) => s.snapshotId).sort()).toEqual([3, 4, 5]);
    expect(await db.snapshot.count()).toBe(5);
    expect(await db.event.count()).toBe(events);
    expect(await db.playerDailyStat.count({ where: { playerId: 1 } })).toBe(5);
    expect(await pruneVillageSnapshots(db, 3)).toBe(0);
  });
});
