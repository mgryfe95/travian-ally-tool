import type { PrismaClient } from "@prisma/client";
import { ClaudeAdvisor, AdviceError, type Advisor } from "../ai/advice";
import { buildSituation, situationHash } from "../ai/situation";
import { monthSpend, recordUsage, type MonthSpend } from "../ai/usage";
import { env } from "../env";
import { AppError } from "../i18n/errors";
import { dayInTz } from "../import/importer";
import { hasPermission } from "../permissions";
import { loadMatrix, type Actor } from "./context";

let advisor: Advisor | null | undefined;
/** Echter Advisor nur mit ANTHROPIC_API_KEY (Modell: ANTHROPIC_MODEL, sonst Haiku 5.5). */
export const getAdvisor = (): Advisor | null => {
  if (advisor === undefined) { const e = env(); advisor = e.ANTHROPIC_API_KEY ? new ClaudeAdvisor(e.ANTHROPIC_API_KEY, e.ANTHROPIC_MODEL || undefined) : null; }
  return advisor;
};
export const setAdvisor = (a: Advisor | null | undefined) => { advisor = a; };

/** Höchstens so viele fehlgeschlagene Läufe je Tag (Fehler verbrauchen den Tageslauf nicht, kosten aber Geld). */
const MAX_ERRORS_PER_DAY = 3;

export type GateReason = "noPermission" | "noKey" | "noVillages" | "budget" | "daily" | "unchanged" | "errors" | "running";
export type AdviceStatus = { allowed: boolean; reason?: GateReason; lastRun: { createdAt: Date; status: string; summary: string } | null; spend: MonthSpend };

const running = new Set<string>();

async function gate(db: PrismaClient, actor: Actor, now: Date, ownLock = false): Promise<{ status: AdviceStatus; hash?: string; situation?: Awaited<ReturnType<typeof buildSituation>> }> {
  const spend = await monthSpend(db, now);
  const last = await db.adviceRun.findFirst({ where: { userId: actor.id, status: "ok" }, orderBy: { id: "desc" } });
  const lastRun = last ? { createdAt: last.createdAt, status: last.status, summary: last.summary } : null;
  const deny = (reason: GateReason) => ({ status: { allowed: false, reason, lastRun, spend } });
  if (!hasPermission(actor.role, "ai.advice", await loadMatrix(db))) return deny("noPermission");
  if (!getAdvisor()) return deny("noKey");
  if (!ownLock && running.has(actor.id)) return deny("running");
  if (spend.exhausted) return deny("budget");
  const tz = env().GAME_TIMEZONE;
  const today = dayInTz(now, tz);
  if (last && last.trigger === "daily" && dayInTz(last.createdAt, tz) === today) return deny("daily");
  const since = new Date(now.getTime() - 24 * 3600_000);
  const errors = await db.adviceRun.findMany({ where: { userId: actor.id, status: "error", createdAt: { gte: since } }, select: { createdAt: true } });
  if (errors.filter((r) => dayInTz(r.createdAt, tz) === today).length >= MAX_ERRORS_PER_DAY) return deny("errors");
  const situation = await buildSituation(db, actor.id, now);
  if (situation.villages.length === 0) return deny("noVillages");
  const hash = situationHash(situation);
  if (last && last.inputHash === hash) return deny("unchanged");
  return { status: { allowed: true, lastRun, spend }, hash, situation };
}

export async function adviceStatus(db: PrismaClient, actor: Actor, now = new Date()): Promise<AdviceStatus> {
  return (await gate(db, actor, now)).status;
}

export class AdviceGateError extends AppError {
  readonly status = 429;
}

/** Ein Tageslauf: Lagebild → Claude → Vorschläge speichern (ältere offene werden ersetzt). Fremde Dorf-IDs aus der Antwort werden verworfen. */
export async function runAdvice(db: PrismaClient, actor: Actor, locale: string, now = new Date()): Promise<{ runId: number; count: number }> {
  if (running.has(actor.id)) throw new AdviceGateError("err.advice.gate.running");
  running.add(actor.id); // synchron vor dem ersten await: zwei gleichzeitige Klicks lösen nur einen Lauf aus
  try {
    const g = await gate(db, actor, now, true);
    if (!g.status.allowed || !g.situation || !g.hash) throw new AdviceGateError(`err.advice.gate.${g.status.reason ?? "running"}` as const);
    const own = new Set(g.situation.villages.map((v) => v.id));
    let result;
    try {
      result = await getAdvisor()!.advise(g.situation, { locale, onUsage: (model, usage) => recordUsage(db, { userId: actor.id, feature: "advice", model, usage }) });
    } catch (e) {
      await db.adviceRun.create({ data: { userId: actor.id, trigger: "daily", inputHash: g.hash, status: "error", errorKey: e instanceof AppError ? e.key : "err.advice.failed" } });
      throw e instanceof AdviceError ? e : new AdviceError("err.advice.failed");
    }
    const run = await db.$transaction(async (tx) => {
      await tx.recommendation.updateMany({ where: { userId: actor.id, status: "open" }, data: { status: "replaced" } });
      return tx.adviceRun.create({
        data: {
          userId: actor.id, trigger: "daily", inputHash: g.hash!, status: "ok", summary: result.summary,
          recommendations: { create: result.recommendations.map((r) => ({ userId: actor.id, villageId: r.villageId !== null && own.has(r.villageId) ? r.villageId : null, type: r.type, priority: r.priority, title: r.title, reason: r.reason })) },
        },
      });
    });
    return { runId: run.id, count: result.recommendations.length };
  } finally {
    running.delete(actor.id);
  }
}

/** Status eines eigenen Vorschlags setzen – nur der Besitzer (WHERE id UND userId). */
export async function setRecommendationStatus(db: PrismaClient, userId: string, id: number, status: "done" | "dismissed" | "open") {
  const r = await db.recommendation.updateMany({ where: { id, userId }, data: { status } });
  if (r.count === 0) throw new AdviceError("err.notFound");
}

export async function openRecommendations(db: PrismaClient, userId: string, villageId?: number) {
  return db.recommendation.findMany({ where: { userId, status: "open", ...(villageId !== undefined ? { villageId } : {}) }, orderBy: [{ priority: "asc" }, { id: "asc" }] });
}
