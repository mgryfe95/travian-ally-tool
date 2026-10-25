import type { PrismaClient } from "@prisma/client";
import { aiClient, NotImplementedError } from "./client";
import { applyReading } from "./apply";
import { recordUsage } from "./usage";
import type { Example } from "./claude";
import { readingSchema, type Reading } from "./reading";
import { agreementOf, assess, type Assessment, type Issue } from "./validate";
import { env } from "../env";
import { ownVillages } from "../services/villages";
import { releaseScreenshotFiles } from "../screenshots";
import { screenshotStorage } from "../storage";
import { translate, type Locale, type MessageKey, type Params } from "../i18n";
import { AppError } from "../i18n/errors";

/** `reason` ist englisch; `reasonKey`/`reasonParams` für die Anzeige in der Nutzersprache (siehe `reasonText`). */
export type PipelineResult = { status: "uploaded" | "parsed" | "needs_review" | "failed"; reason?: string; reasonKey?: MessageKey; reasonParams?: Params };

const withReason = (status: PipelineResult["status"], key: MessageKey, params?: Params): PipelineResult => ({ status, reason: translate("en", key, params), reasonKey: key, reasonParams: params });

/** Hinweistext eines Ergebnisses in der Sprache des Nutzers (Fallback: englischer `reason`). */
export const reasonText = (r: PipelineResult, locale: Locale): string | null => (r.reasonKey ? translate(locale, r.reasonKey, r.reasonParams) : r.reason ?? null);

/** Was in Screenshot.parsed steht. */
export type ParsedShot = { reading?: Reading; issues?: Issue[]; agreement?: number; error?: string; errorKey?: MessageKey; errorParams?: Params; confirmedBy?: string; corrected?: boolean; applied?: { villageId: number; areas: string[] }[] };

const MAX_EXAMPLES = 6;
const KEEP_EXAMPLES_PER_KIND = 30;

async function knownVillages(db: PrismaClient, userId: string) {
  return (await ownVillages(db, userId)).map((v) => ({ id: v.id, name: v.name, x: v.x, y: v.y }));
}

/** Lern-Beispiele: je Art das jüngste bestätigte Beispiel (Bild + richtige Lesung), höchstens MAX_EXAMPLES. */
export async function loadExamples(db: PrismaClient): Promise<Example[]> {
  const rows = await db.visionExample.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const seen = new Set<string>();
  const out: Example[] = [];
  for (const r of rows) {
    if (seen.has(r.kind) || out.length >= MAX_EXAMPLES) continue;
    const gold = readingSchema.safeParse(r.gold);
    if (!gold.success) continue;
    try {
      out.push({ image: await screenshotStorage().get(r.storageKey), gold: gold.data });
      seen.add(r.kind);
    } catch {
      /* Bild nicht mehr vorhanden → Beispiel überspringen */
    }
  }
  return out;
}

export const learningDone = async (db: PrismaClient, kind: string) => {
  const need = env().VISION_LEARNING_MIN;
  return need === 0 || (await db.visionExample.count({ where: { kind } })) >= need;
};

/**
 * Pipeline: lesen (1–3 Durchläufe, Konsens) → deterministisch prüfen (Summenzeilen, Spaltenzahl, Koordinaten, Dörfer des Kontos)
 * → Konfidenz. Hohe Konfidenz UND Lernmodus für diese Art abgeschlossen → automatisch in den Dorfzustand; sonst needs_review.
 */
export class VisionPipeline {
  constructor(private readonly db: PrismaClient) {}

  async process(screenshotId: number): Promise<PipelineResult> {
    const shot = await this.db.screenshot.findUnique({ where: { id: screenshotId } });
    if (!shot) return withReason("failed", "err.vision.screenshotNotFound");
    const image = await screenshotStorage().get(shot.storageKey);
    const e = env();
    try {
      const [examples, aliases, known] = await Promise.all([loadExamples(this.db), this.db.visionAlias.findMany({ orderBy: { term: "asc" } }), knownVillages(this.db, shot.userId)]);
      const runs = await Promise.allSettled(Array.from({ length: e.VISION_PASSES }, () => aiClient().read(image, { examples, aliases, expectedKind: shot.expectedKind ?? undefined, onUsage: (model, usage) => recordUsage(this.db, { userId: shot.userId, feature: "vision", model, usage }).catch((err) => console.error("[ai] usage", err)) })));
      const ok = runs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      if (ok.length === 0) {
        const err = runs.find((r) => r.status === "rejected") as PromiseRejectedResult;
        if (err.reason instanceof NotImplementedError) return withReason("uploaded", err.reason.key, err.reason.params);
        throw err.reason;
      }
      const reading = ok[0]!;
      const agreement = ok.length > 1 ? ok.slice(1).reduce((m, o) => Math.min(m, agreementOf(reading, o)), 1) : 0.9; // ein Durchlauf allein = weniger Vertrauen
      const a: Assessment = assess(reading, known, agreement);
      // Gewählte Art weicht von der erkannten ab → nicht automatisch übernehmen, sondern prüfen lassen
      if (shot.expectedKind && shot.expectedKind !== reading.kind) a.issues.push({ level: "soft", key: "err.check.kindMismatch", params: { expected: shot.expectedKind, found: reading.kind }, message: translate("en", "err.check.kindMismatch", { expected: shot.expectedKind, found: reading.kind }) });
      const parsed: ParsedShot = { reading, issues: a.issues, agreement };
      const auto = a.confidence >= e.VISION_AUTO_ACCEPT && a.issues.length === 0 && reading.kind !== "UNKNOWN" && (await learningDone(this.db, reading.kind));
      let applied;
      if (auto) {
        applied = await applyReading(this.db, shot.userId, shot.id, reading, known, shot.villageId ?? undefined);
        parsed.applied = applied;
      }
      const status = auto && applied && applied.length > 0 ? "parsed" : "needs_review";
      await this.db.screenshot.update({
        where: { id: shot.id },
        data: { detectedKind: reading.kind, detectedDevice: reading.device, confidence: a.confidence, status, parsed: parsed as object, villageId: shot.villageId ?? a.village?.id ?? Object.values(a.matched)[0] ?? null },
      });
      // Automatisch übernommen: Das Bild wird nicht mehr gebraucht (kein Lern-Beispiel) und sofort gelöscht
      if (status === "parsed") await releaseScreenshotFiles(this.db, [shot.storageKey]);
      return { status };
    } catch (err) {
      const msg = (err as Error).message.slice(0, 300);
      const known = err instanceof AppError ? { errorKey: err.key, ...(err.params ? { errorParams: err.params } : {}) } : {};
      await this.db.screenshot.update({ where: { id: shot.id }, data: { status: "failed", parsed: { error: msg, ...known } } });
      return { status: "failed", reason: msg, ...(err instanceof AppError ? { reasonKey: err.key, reasonParams: err.params } : {}) };
    }
  }

  /** Nutzer bestätigt (optional korrigiert): übernehmen und als Lern-Beispiel speichern. */
  async confirm(screenshotId: number, userId: string, corrected?: unknown, villageId?: number, asExample = true): Promise<PipelineResult> {
    const shot = await this.db.screenshot.findUnique({ where: { id: screenshotId } });
    if (!shot || shot.userId !== userId) return withReason("failed", "err.vision.screenshotNotFound");
    const parsed = (shot.parsed ?? {}) as ParsedShot;
    const candidate = corrected ?? parsed.reading;
    const reading = readingSchema.safeParse(candidate);
    if (!reading.success) return withReason("failed", "err.vision.noValidReading");
    const known = await knownVillages(this.db, userId);
    const a = assess(reading.data, known);
    if (reading.data.kind === "UNKNOWN") return withReason("failed", "err.vision.kindUnknown");
    const chosen = villageId !== undefined && known.some((k) => k.id === villageId) ? villageId : undefined;
    const applied = await applyReading(this.db, userId, shot.id, reading.data, known, chosen ?? shot.villageId ?? undefined, new Date(), chosen !== undefined);
    // Nur Arten, die in den Dorfzustand fließen, müssen ein Dorf treffen
    const writes = !["VILLAGE_TROOPS_PRESENT", "BATTLE_REPORT"].includes(reading.data.kind);
    if (writes && applied.length === 0) return withReason("failed", "err.vision.noVillageMatch");
    await this.db.screenshot.update({
      where: { id: shot.id },
      data: { villageId: chosen ?? shot.villageId, status: "parsed", detectedKind: reading.data.kind, detectedDevice: reading.data.device, parsed: { ...parsed, reading: reading.data, issues: a.issues, confirmedBy: userId, corrected: corrected !== undefined, applied } as object },
    });
    if (!asExample) {
      // Kein Kern-Beispiel: Das Bild wird nicht mehr gebraucht und sofort gelöscht
      await releaseScreenshotFiles(this.db, [shot.storageKey]);
      return { status: "parsed" };
    }
    await this.db.visionExample.create({ data: { kind: reading.data.kind, storageKey: shot.storageKey, gold: reading.data as object, createdBy: userId } });
    const old = await this.db.visionExample.findMany({ where: { kind: reading.data.kind }, orderBy: { createdAt: "desc" }, skip: KEEP_EXAMPLES_PER_KIND, select: { id: true, storageKey: true } });
    if (old.length) {
      await this.db.visionExample.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      // Aus der Beispielauswahl gefallene Bilder werden nicht mehr gebraucht
      await releaseScreenshotFiles(this.db, old.map((o) => o.storageKey));
    }
    return { status: "parsed" };
  }

  /** Bestätigung zurücknehmen (z. B. versehentlich bestätigt): Lern-Beispiel entfernen, Screenshot wieder zur Prüfung stellen. Bereits übernommene Dorfdaten bleiben und lassen sich im Dorf korrigieren. */
  async retract(screenshotId: number, userId: string): Promise<PipelineResult> {
    const shot = await this.db.screenshot.findUnique({ where: { id: screenshotId } });
    if (!shot || shot.userId !== userId) return withReason("failed", "err.vision.screenshotNotFound");
    const parsed = (shot.parsed ?? {}) as ParsedShot;
    if (!parsed.confirmedBy || !parsed.reading || shot.removedAt) return withReason("failed", "err.vision.cannotRetract");
    await this.db.visionExample.deleteMany({ where: { storageKey: shot.storageKey } });
    const { confirmedBy: _c, applied: _a, ...rest } = parsed;
    void _c; void _a;
    await this.db.screenshot.update({ where: { id: shot.id }, data: { status: "needs_review", parsed: rest as object } });
    return { status: "needs_review" };
  }
}
