/**
 * Schnittstellen der KI-Anbindung (Phase 2). In diesem Auftrag gibt es nur Stubs – echte Claude-API-Calls
 * (`@anthropic-ai/sdk`, Modell aus ENV `ANTHROPIC_MODEL`) folgen nach Freigabe von Datenquelle und Prompts.
 */
export type ScreenshotKind = "RALLY_POINT" | "VILLAGE_STATS" | "VILLAGE_VIEW" | "RESOURCE_VIEW" | "UNKNOWN";
export type DeviceKind = "DESKTOP" | "MOBILE" | "UNKNOWN";

export type Classification = { kind: ScreenshotKind; device: DeviceKind; confidence: number };

export type Extraction = {
  /** Art-spezifisches, strikt validiertes JSON (Schema je Art folgt mit der echten Pipeline). */
  data: unknown;
  confidence: number;
};

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
  classifyScreenshot(image: Buffer): Promise<Classification>;
  extract(kind: ScreenshotKind, image: Buffer): Promise<Extraction>;
  advise(input: AdviceInput): Promise<Advice[]>;
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} ist in dieser Ausbaustufe noch nicht aktiv`);
  }
}

/** Stub: klassifiziert nichts, berät nicht. Dient als Platzhalter und für Tests der Verdrahtung. */
export class StubAiClient implements AiClient {
  async classifyScreenshot(): Promise<Classification> {
    return { kind: "UNKNOWN", device: "UNKNOWN", confidence: 0 };
  }
  async extract(): Promise<Extraction> {
    throw new NotImplementedError("Screenshot-Extraktion");
  }
  async advise(): Promise<Advice[]> {
    return [];
  }
}

let client: AiClient = new StubAiClient();
export const aiClient = () => client;
export const setAiClient = (c: AiClient) => {
  client = c;
};
