import { describe, expect, it } from "vitest";
import { costUsd, pricesStale } from "./usage";

describe("KI-Kosten", () => {
  it("Haiku 5.5: Listenpreise, Cache getrennt, über 100k Prompt höhere Stufe", () => {
    expect(costUsd("claude-haiku-5-5", { input_tokens: 100_000, output_tokens: 1_000_000 })).toBeCloseTo(0.01 + 0.5);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 10_000, output_tokens: 2_000, cache_read_input_tokens: 50_000, cache_creation_input_tokens: 4_000 }))
      .toBeCloseTo((10_000 * 0.1 + 2_000 * 0.5 + 50_000 * 0.01 + 4_000 * 0.125) / 1e6);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 60_000, output_tokens: 1_000, cache_read_input_tokens: 50_000 }))
      .toBeCloseTo((60_000 * 0.5 + 1_000 * 2.5 + 50_000 * 0.05) / 1e6);
  });
  it("unbekanntes Modell wird vorsichtig (Opus) bepreist", () => {
    expect(costUsd("claude-x", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(4);
  });
  it("Preise nach einem halben Jahr veraltet", () => {
    const now = new Date("2026-10-25");
    expect(pricesStale(null, now)).toBe(true);
    expect(pricesStale("2026-06-01", now)).toBe(false);
    expect(pricesStale("2026-03-01", now)).toBe(true);
  });
});
