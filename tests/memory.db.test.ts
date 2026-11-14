import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { orQuery, searchMemory, upsertMemory, withUserScope } from "@/lib/services/memory";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "MemoryDoc" RESTART IDENTITY`;
  await upsertMemory(db, "u1", { sourceType: "incident", sourceId: 1, title: "Raid by Evil", body: "lost clubswingers" });
  await upsertMemory(db, "u2", { sourceType: "incident", sourceId: 2, title: "Attack by Evil", body: "secret of u2" });
  // globaler Eintrag (Wartungspfad als Superuser, ohne Nutzer-Scope)
  await db.$executeRaw`INSERT INTO "MemoryDoc" ("ownerId", "scope", "sourceType", "sourceId", "title", "body", "updatedAt") VALUES (NULL, 'global', 'knowledge', 100, 'Evil tactics', 'general', now())`;
});
afterAll(() => db.$disconnect());

describe("Gedächtnis: harter Nutzerfilter + Row-Level Security", () => {
  it("Suche liefert eigene + globale Einträge, nie fremde", async () => {
    const hits = await searchMemory(db, "u1", "evil");
    expect(hits.map((h) => h.sourceId).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 100]);
    expect(hits.some((h) => h.body.includes("secret"))).toBe(false);
    expect((await searchMemory(db, "u2", "evil")).map((h) => h.sourceId).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([2, 100]);
  });
  it("RLS greift auch ohne WHERE-Filter in der Abfrage", async () => {
    const rows = await withUserScope(db, "u1", (tx) => tx.$queryRaw<{ sourceId: number }[]>`SELECT "sourceId" FROM "MemoryDoc" ORDER BY "sourceId"`);
    expect(rows.map((r) => r.sourceId)).toEqual([1, 100]);
    const none = await withUserScope(db, "u3", (tx) => tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "MemoryDoc" WHERE "scope" = 'user'`);
    expect(Number(none[0]!.n)).toBe(0);
  });
  it("Schreiben nur für sich selbst: fremder Besitzer, fremde Zeile, globale Zeile werden abgewiesen", async () => {
    await expect(withUserScope(db, "u1", (tx) => tx.$executeRaw`INSERT INTO "MemoryDoc" ("ownerId", "scope", "sourceType", "sourceId", "title", "updatedAt") VALUES ('u2', 'user', 'incident', 9, 'x', now())`)).rejects.toThrow();
    await expect(withUserScope(db, "u1", (tx) => tx.$executeRaw`INSERT INTO "MemoryDoc" ("ownerId", "scope", "sourceType", "sourceId", "title", "updatedAt") VALUES (NULL, 'global', 'knowledge', 9, 'x', now())`)).rejects.toThrow();
    expect(await withUserScope(db, "u1", (tx) => tx.$executeRaw`UPDATE "MemoryDoc" SET "title" = 'hacked'`)).toBe(1); // nur die eigene Zeile
    expect(await withUserScope(db, "u1", (tx) => tx.$executeRaw`DELETE FROM "MemoryDoc"`)).toBe(1);
    const all = await db.$queryRaw<{ title: string }[]>`SELECT "title" FROM "MemoryDoc" ORDER BY "sourceId"`;
    expect(all.map((r) => r.title)).toEqual(["Attack by Evil", "Evil tactics"]);
    // Upsert auf die Quelle eines anderen Nutzers überschreibt nichts (Konflikt-Update ist auf den eigenen Besitzer beschränkt)
    await upsertMemory(db, "u1", { sourceType: "incident", sourceId: 2, title: "stolen", body: "" }).catch(() => undefined);
    expect((await db.$queryRaw<{ title: string }[]>`SELECT "title" FROM "MemoryDoc" WHERE "sourceId" = 2`)[0]?.title).toBe("Attack by Evil");
  });
  it("Rolle und Nutzer gelten nur in der Transaktion; leere Nutzer-ID wird abgelehnt", async () => {
    await withUserScope(db, "u1", async () => undefined);
    const who = await db.$queryRaw<{ r: string; u: string | null }[]>`SELECT current_user AS r, current_setting('app.user_id', true) AS u`;
    expect(who[0]?.r).not.toBe("ally_memory");
    expect(who[0]?.u ?? "").toBe("");
    await expect(withUserScope(db, "", async () => 1)).rejects.toThrow();
  });
  it("ODER-Suche aus Begriffen, Sonderzeichen entfernt, Begrenzung", async () => {
    expect(orQuery(["Evil", "Evil", "a", "x)y"])).toBe('"Evil" or "x y"');
    expect((await searchMemory(db, "u1", orQuery(["clubswingers", "tactics"]))).length).toBe(2);
    expect(await searchMemory(db, "u1", "   ")).toEqual([]);
  });
});
