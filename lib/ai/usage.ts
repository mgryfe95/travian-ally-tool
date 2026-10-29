import type { PrismaClient } from "@prisma/client";

/**
 * Listenpreise in USD je Million Token (Quelle: platform.claude.com/docs/en/about-claude/pricing, abgerufen 2026-10-25).
 * Haiku 5.5 wird nach Prompt-Länge bepreist: über 100 000 Token (inkl. Cache) gelten für den ganzen Aufruf die höheren Preise.
 */
type Rate = { maxPrompt: number; input: number; cacheWrite: number; cacheRead: number; output: number };
export const RATES: Record<string, Rate[]> = {
  "claude-haiku-5-5": [
    { maxPrompt: 100_000, input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
    { maxPrompt: Infinity, input: 0.5, cacheWrite: 0.625, cacheRead: 0.05, output: 2.5 },
  ],
  "claude-sonnet-5-5": [{ maxPrompt: Infinity, input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 }],
  "claude-opus-5-5": [{ maxPrompt: Infinity, input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 }],
};
/** Unbekanntes Modell: vorsichtig mit den Opus-Preisen rechnen, damit das Budget nicht unterschätzt wird. */
const FALLBACK = RATES["claude-opus-5-5"]!;

export type TokenUsage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };

export function costUsd(model: string, u: TokenUsage): number {
  const write = u.cache_creation_input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const prompt = u.input_tokens + write + read;
  const tiers = RATES[model] ?? FALLBACK;
  const r = tiers.find((x) => prompt <= x.maxPrompt) ?? tiers[tiers.length - 1]!;
  return (u.input_tokens * r.input + write * r.cacheWrite + read * r.cacheRead + u.output_tokens * r.output) / 1_000_000;
}

export type Feature = "vision" | "advice" | "incident";

export async function recordUsage(db: Pick<PrismaClient, "aiUsage">, e: { userId?: string | null; feature: Feature; model: string; usage: TokenUsage }) {
  await db.aiUsage.create({
    data: {
      userId: e.userId ?? null, feature: e.feature, model: e.model,
      inputTokens: e.usage.input_tokens, outputTokens: e.usage.output_tokens,
      cacheReadTokens: e.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: e.usage.cache_creation_input_tokens ?? 0,
      costUsd: costUsd(e.model, e.usage),
    },
  });
}

/** Einstellungen (Tabelle Setting) mit Defaults; Hetzner-Preise halbjährlich prüfen (`costPricesCheckedAt`). */
export const COST_DEFAULTS = {
  aiBudgetEur: 15,
  usdEur: 0.92,
  /** Hetzner Object Storage: im Grundpreis enthaltener Speicher (TB) und Preis je weiterem TB-Monat (EUR). Das Fixum zählt nicht mit. */
  s3IncludedTb: 1,
  s3ExtraPerTbEur: 8.7,
} as const;
export type CostSettings = { [K in keyof typeof COST_DEFAULTS]: number } & { pricesCheckedAt: string | null };

export async function getCostSettings(db: Pick<PrismaClient, "setting">): Promise<CostSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: [...Object.keys(COST_DEFAULTS), "costPricesCheckedAt"] } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: keyof typeof COST_DEFAULTS) => { const n = Number(byKey.get(k)); return Number.isFinite(n) && n >= 0 && byKey.has(k) ? n : COST_DEFAULTS[k]; };
  return { aiBudgetEur: num("aiBudgetEur"), usdEur: num("usdEur"), s3IncludedTb: num("s3IncludedTb"), s3ExtraPerTbEur: num("s3ExtraPerTbEur"), pricesCheckedAt: byKey.get("costPricesCheckedAt") ?? null };
}

/** Hetzner-Preise gelten als veraltet, wenn sie seit mehr als einem halben Jahr nicht geprüft wurden. */
export const pricesStale = (checkedAt: string | null, now = new Date()) => !checkedAt || now.getTime() - new Date(checkedAt).getTime() > 182 * 86_400_000;

export const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export type MonthSpend = { aiUsd: number; aiEur: number; storageBytes: number; s3Eur: number; totalEur: number; budgetEur: number; exhausted: boolean };

/** Kosten des laufenden Monats: KI (Protokoll) + variabler S3-Anteil über dem Inklusiv-Volumen (Fixum nicht enthalten). */
export async function monthSpend(db: Pick<PrismaClient, "aiUsage" | "setting" | "screenshot" | "attachment">, now = new Date()): Promise<MonthSpend> {
  const [cfg, ai, shots, files] = await Promise.all([
    getCostSettings(db),
    db.aiUsage.aggregate({ where: { createdAt: { gte: monthStart(now) } }, _sum: { costUsd: true } }),
    db.screenshot.aggregate({ _sum: { sizeBytes: true } }),
    db.attachment.aggregate({ where: { removedAt: null }, _sum: { sizeBytes: true } }),
  ]);
  const aiUsd = ai._sum.costUsd ?? 0;
  const storageBytes = (shots._sum.sizeBytes ?? 0) + (files._sum.sizeBytes ?? 0);
  const s3Eur = Math.max(0, storageBytes / 1e12 - cfg.s3IncludedTb) * cfg.s3ExtraPerTbEur;
  const aiEur = aiUsd * cfg.usdEur;
  const totalEur = aiEur + s3Eur;
  return { aiUsd, aiEur, storageBytes, s3Eur, totalEur, budgetEur: cfg.aiBudgetEur, exhausted: totalEur >= cfg.aiBudgetEur };
}

export class CostSettingsError extends Error {}

/** Admin: Werte speichern (nur endliche Zahlen ≥ 0); `checked` = Preise heute geprüft. */
export async function saveCostSettings(db: Pick<PrismaClient, "setting">, input: Partial<Record<keyof typeof COST_DEFAULTS, string>>, checked: boolean, now = new Date()) {
  for (const k of Object.keys(COST_DEFAULTS) as (keyof typeof COST_DEFAULTS)[]) {
    const raw = input[k]?.trim().replace(",", ".");
    if (raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new CostSettingsError(k);
    await db.setting.upsert({ where: { key: k }, create: { key: k, value: String(n) }, update: { value: String(n) } });
  }
  if (checked) await db.setting.upsert({ where: { key: "costPricesCheckedAt" }, create: { key: "costPricesCheckedAt", value: now.toISOString() }, update: { value: now.toISOString() } });
}

/** KI-Kosten des Monats je Funktion (USD). */
export async function monthByFeature(db: Pick<PrismaClient, "aiUsage">, now = new Date()) {
  const rows = await db.aiUsage.groupBy({ by: ["feature"], where: { createdAt: { gte: monthStart(now) } }, _sum: { costUsd: true }, _count: true });
  return rows.map((r) => ({ feature: r.feature, usd: r._sum.costUsd ?? 0, calls: r._count }));
}
