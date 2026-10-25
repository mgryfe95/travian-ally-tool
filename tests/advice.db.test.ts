import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Advisor } from "@/lib/ai/advice";
import { buildSituation } from "@/lib/ai/situation";
import { getCostSettings, monthSpend, recordUsage, saveCostSettings } from "@/lib/ai/usage";
import { adviceStatus, openRecommendations, runAdvice, setAdvisor, setRecommendationStatus } from "@/lib/services/advice";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
const member = { id: "u1", role: "MEMBER" as const };
let calls = 0;
const fake = (villageIds: (number | null)[]): Advisor => ({
  async advise(_s, opts) {
    calls++;
    await opts.onUsage?.("claude-haiku-5-5", { input_tokens: 10_000, output_tokens: 1_000 });
    return { summary: "ok", recommendations: villageIds.map((v, i) => ({ villageId: v, type: "build" as const, priority: i + 1, title: `T${i}`, reason: "r" })) };
  },
});

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE "User","Village","Setting","VillageProfile","VillageState","AdviceRun","Recommendation","AiUsage","RolePermission" RESTART IDENTITY CASCADE`;
  await db.user.createMany({ data: [{ id: "u1", name: "u1", email: "u1@x.de", role: "MEMBER" }, { id: "u2", name: "u2", email: "u2@x.de", role: "MEMBER" }] });
  await db.village.createMany({ data: [{ id: 10, fieldId: 1, x: 0, y: 0, name: "A", playerId: 1, population: 50, extra: {} }, { id: 20, fieldId: 3, x: 2, y: 2, name: "C", playerId: 2, population: 10, extra: {} }] });
  await db.playerLink.createMany({ data: [{ userId: "u1", travianPlayerId: 1, status: "verified", method: "invite" }, { userId: "u2", travianPlayerId: 2, status: "verified", method: "invite" }] });
  await db.villageProfile.create({ data: { villageId: 10, userId: "u1", aiInstructions: "Hammer", goal: "HAMMER" } });
  calls = 0;
  setAdvisor(fake([10, 20, null]));
});
afterAll(async () => { setAdvisor(undefined); await db.$disconnect(); });

describe("KI-Vorschläge", () => {
  it("Lagebild enthält nur eigene Dörfer mit Dorftyp und Instruktionen", async () => {
    const s = await buildSituation(db, "u1");
    expect(s.villages.map((v) => v.id)).toEqual([10]);
    expect(s.villages[0]?.goal).toMatch(/^HAMMER/);
    expect(s.villages[0]?.instructions).toBe("Hammer");
  });
  it("Lauf speichert Vorschläge, verwirft fremde Dorf-IDs, protokolliert Kosten; danach 1×/Tag und kein Lauf ohne Änderung", async () => {
    const now = new Date("2026-10-25T10:00:00Z");
    await runAdvice(db, member, "de", now);
    const recs = await openRecommendations(db, "u1");
    expect(recs.map((r) => r.villageId)).toEqual([10, null, null]); // 20 gehört u2 → null
    expect(await db.aiUsage.count({ where: { userId: "u1", feature: "advice" } })).toBe(1);
    expect((await adviceStatus(db, member, now)).reason).toBe("daily");
    // nächster Tag, aber nichts geändert
    const tomorrow = new Date("2026-10-26T10:00:00Z");
    expect((await adviceStatus(db, member, tomorrow)).reason).toBe("unchanged");
    await db.villageProfile.update({ where: { villageId_userId: { villageId: 10, userId: "u1" } }, data: { goal: "DEFF" } });
    await runAdvice(db, member, "de", tomorrow);
    expect(calls).toBe(2);
    expect(await db.recommendation.count({ where: { userId: "u1", status: "replaced" } })).toBe(3);
  });
  it("ohne Recht (Gast) und bei aufgebrauchtem Budget kein Lauf", async () => {
    expect((await adviceStatus(db, { id: "u1", role: "GUEST" })).reason).toBe("noPermission");
    await recordUsage(db, { feature: "vision", model: "claude-haiku-5-5", usage: { input_tokens: 0, output_tokens: 40_000_000 } }); // 40M × 2,50 $ = 100 $
    expect((await adviceStatus(db, member)).reason).toBe("budget");
    await expect(runAdvice(db, member, "de")).rejects.toThrow();
    expect(calls).toBe(0);
  });
  it("Status setzen nur für eigene Vorschläge", async () => {
    await runAdvice(db, member, "de");
    const [r] = await openRecommendations(db, "u1");
    await expect(setRecommendationStatus(db, "u2", r!.id, "done")).rejects.toThrow();
    await setRecommendationStatus(db, "u1", r!.id, "done");
    expect((await db.recommendation.findUnique({ where: { id: r!.id } }))?.status).toBe("done");
  });

  it("Kosten: KI-Protokoll × Kurs + S3 nur über Inklusiv-Volumen; Einstellungen validiert", async () => {
    await saveCostSettings(db, { usdEur: "0,5", s3IncludedTb: "0", s3ExtraPerTbEur: "10" }, true);
    expect((await getCostSettings(db)).pricesCheckedAt).not.toBeNull();
    await expect(saveCostSettings(db, { aiBudgetEur: "-1" }, false)).rejects.toThrow();
    await recordUsage(db, { feature: "advice", model: "claude-haiku-5-5", usage: { input_tokens: 0, output_tokens: 2_000_000 } }); // Prompt 0 Token → untere Stufe: 2M × 0,50 $ = 1 $
    await db.screenshot.create({ data: { userId: "u1", storageKey: "k", sizeBytes: 1_000_000_000 } }); // 0,001 TB
    const m = await monthSpend(db);
    expect(m.aiEur).toBeCloseTo(0.5);
    expect(m.s3Eur).toBeCloseTo(0.01);
    expect(m.totalEur).toBeCloseTo(0.51);
  });
});
