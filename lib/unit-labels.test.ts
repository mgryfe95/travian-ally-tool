import { describe, expect, it } from "vitest";
import { makeT } from "./i18n";
import { unitLabel, type UnitLabels } from "./unit-labels";

const labels: UnitLabels = { byName: new Map([["legionäre", { en: "Legionnaire", de: "Legionäre" }], ["legionnaire", { en: "Legionnaire", de: "Legionäre" }]]) };

describe("unitLabel", () => {
  it("übersetzt Namen, Held und Platzhalter je Sprache", () => {
    expect(unitLabel(labels, "Legionäre", "en", makeT("en"))).toBe("Legionnaire");
    expect(unitLabel(labels, "Legionnaire", "de", makeT("de"))).toBe("Legionäre");
    expect(unitLabel(labels, "Held", "en", makeT("en"))).toBe("Hero");
    expect(unitLabel(labels, "Einheit 3", "en", makeT("en"))).toBe("Unit 3");
    expect(unitLabel(labels, "Unbekannt", "en", makeT("en"))).toBe("Unbekannt");
  });
});
