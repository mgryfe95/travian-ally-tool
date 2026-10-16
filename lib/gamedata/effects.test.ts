import { describe, expect, it } from "vitest";
import { benefitsMarkdown, formatDelta, formatEffect, levelBenefits, presentEffects } from "./effects";

const L = (level: number, effects: Record<string, number | null>) => ({ level, costWood: 10 * level, costClay: 0, costIron: 0, costCrop: 0, buildTimeSec: 3600 * level, effects });

describe("effects", () => {
  it("formatiert je Art einheitlich", () => {
    expect(formatEffect("production1", 13, "en")).toBe("13 /h");
    expect(formatEffect("productionBoost1", 0.05, "en")).toBe("+5 %");
    expect(formatEffect("trainingTimeStable", 0.9, "en")).toBe("−10 %");
    expect(formatEffect("buildingTime", 1, "en")).toBe("±0 %");
    expect(formatEffect("storageWarehouse", 1200, "de")).toBe("1.200");
    expect(formatEffect("smallPartyTime", 86400, "en")).toBe("24:00:00");
    expect(formatEffect("traps", null, "en")).toBe("–");
  });
  it("Delta zur Vorstufe, fehlende Vorstufe zählt als Basis", () => {
    expect(formatDelta("production1", 7, 13, "en")).toBe("+6 /h");
    expect(formatDelta("trainingTimeStable", 1, 0.9, "en")).toBe("−10 pp");
    expect(formatDelta("productionBoost1", 0.4, 0.6, "en", "ui")).toBe("+20 %");
    expect(formatDelta("slots", null, 1, "en")).toBe("+1");
    expect(formatDelta("traps", 10, 10, "en")).toBeNull();
  });
  it("presentEffects ignoriert null und sortiert; levelBenefits liefert normalisierte Werte", () => {
    const lv = [L(1, { traps: 10, slots: null, foo: 2 }), L(2, { traps: 22, slots: 1 })];
    expect(presentEffects(lv)).toEqual(["traps", "slots", "foo"]);
    const b = levelBenefits(lv, 2, "en");
    expect(b.find((x) => x.id === "traps")).toMatchObject({ kind: "count", value: 22, delta: "+12", deltaValue: 12, group: "military" });
  });
  it("Markdown für die KI enthält Werte und Δ", () => {
    const md = benefitsMarkdown("Trapper", [L(1, { traps: 10 }), L(2, { traps: 22 })], 2, (i) => i, "en");
    expect(md).toContain("| 2 | 20 | 0 | 0 | 0 | 1:00:00 | 22 (+12) |");
  });
});
