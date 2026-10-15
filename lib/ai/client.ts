import { ClaudeVision, type ReadOptions } from "./claude";
import type { Reading } from "./reading";
import { env } from "../env";
/**
 * Schnittstellen der KI-Anbindung (Phase 2). In diesem Auftrag gibt es nur Stubs – echte Claude-API-Calls
 * (`@anthropic-ai/sdk`, Modell aus ENV `ANTHROPIC_MODEL`) folgen nach Freigabe von Datenquelle und Prompts.
 */
export type { ReadingKind as ScreenshotKind } from "./reading";
import { AppError } from "../i18n/errors";
export type DeviceKind = "DESKTOP" | "MOBILE" | "UNKNOWN";

export type AdviceInput = {
  scope: "account" | "village";
  accountInstructions: string;
  villageInstructions?: string;
  /** VillageState(s), Spieldaten-DB (Kosten/Nutzen der nächsten Stufen) und map.sql-Umfeld */
  context: Record<string, unknown>;
};

export type Advice = {
  rank: number;
  action: string;
  reason: string;
  /** Kosten und Nutzen kommen aus BuildingLevel (Speed-umgerechnet), nie aus der KI */
  cost?: Record<string, number>;
  benefit?: string;
};

export interface AiClient {
  /** Liest einen Screenshot (Art, Gerät, Werte). Ohne API-Key: NotImplementedError. */
  read(image: Buffer, opts?: ReadOptions): Promise<Reading>;
  advise(input: AdviceInput): Promise<Advice[]>;
}

export class NotImplementedError extends AppError {}

/** Stub: klassifiziert nichts, berät nicht. Dient als Platzhalter und für Tests der Verdrahtung. */
export class StubAiClient implements AiClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async read(_image?: Buffer, _opts?: ReadOptions): Promise<Reading> {
    throw new NotImplementedError("err.ai.screenshotRecognition");
  }
  async advise(): Promise<Advice[]> {
    return [];
  }
}

/** Echter Client, sobald ANTHROPIC_API_KEY gesetzt ist (Modell: ANTHROPIC_MODEL, sonst claude-haiku-5-5). */
export class ClaudeAiClient extends StubAiClient {
  private readonly vision: ClaudeVision;
  constructor(apiKey: string, model?: string) {
    super();
    this.vision = new ClaudeVision(apiKey, model || undefined);
  }
  override read(image: Buffer, opts?: ReadOptions) {
    return this.vision.read(image, opts);
  }
}

let client: AiClient | undefined;
export const aiClient = (): AiClient => {
  if (!client) {
    const e = env();
    client = e.ANTHROPIC_API_KEY ? new ClaudeAiClient(e.ANTHROPIC_API_KEY, e.ANTHROPIC_MODEL) : new StubAiClient();
  }
  return client;
};
export const setAiClient = (c: AiClient | undefined) => {
  client = c;
};
