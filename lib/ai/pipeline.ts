import type { PrismaClient } from "@prisma/client";
import { aiClient, NotImplementedError } from "./client";
import { storage } from "../storage";

export type PipelineResult = { status: "uploaded" | "parsed" | "needs_review" | "failed"; reason?: string };

/**
 * Pipeline: (1) klassifizieren (Art + Gerät), (2) art-spezifisch extrahieren, (3) gegen Spieldaten validieren,
 * (4) in VillageState schreiben. Niedrige Konfidenz → needs_review (Nutzer bestätigt/korrigiert).
 * Stub: ruft nur den (Stub-)Client auf; solange er nichts erkennt, bleibt der Screenshot `uploaded`.
 */
export interface ScreenshotPipeline {
  process(screenshotId: number): Promise<PipelineResult>;
}

export class StubScreenshotPipeline implements ScreenshotPipeline {
  constructor(private readonly db: PrismaClient) {}

  async process(screenshotId: number): Promise<PipelineResult> {
    const shot = await this.db.screenshot.findUnique({ where: { id: screenshotId } });
    if (!shot) return { status: "failed", reason: "Screenshot nicht gefunden" };
    const image = await storage().get(shot.storageKey);
    const c = await aiClient().classifyScreenshot(image);
    await this.db.screenshot.update({ where: { id: shot.id }, data: { detectedKind: c.kind, detectedDevice: c.device, confidence: c.confidence } });
    if (c.kind === "UNKNOWN") return { status: "uploaded", reason: "Automatische Erkennung noch nicht aktiv" };
    try {
      await aiClient().extract(c.kind, image);
    } catch (e) {
      if (e instanceof NotImplementedError) return { status: "uploaded", reason: e.message };
      throw e;
    }
    return { status: "needs_review" };
  }
}
