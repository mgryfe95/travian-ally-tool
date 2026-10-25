import { describe, expect, it } from "vitest";
import type { Reading } from "./ai/reading";
import { draftFromReading, namedUnits, parseCoordText, parseUnitLines, threatDays } from "./incidents";

const row = (name: string, cells: number[], texts: string[] = [], x: number | null = null, y: number | null = null) => ({ name, x, y, current: false, cells, texts });
const reading: Reading = {
  kind: "BATTLE_REPORT", device: "DESKTOP", language: "de", village: null, topBar: null, totals: null, fields: [], buildings: [], selfRating: 0.8, uncertain: [],
  rows: [
    row("info", [100, 0, 0, 0], ["Evil", "Evil Town", "BAD", "Me", "01 Home", "25.10.26 14:03", "raid"]),
    row("attacker_units", [50, 0, 10], [], 12, -34), row("attacker_losses", [5, 0, 0]),
    row("defender_units", [20, 3], [], 1, 2), row("defender_losses", [20, 1]),
  ],
};

describe("Incidents", () => {
  it("Kampfbericht-Lesung → Entwurf", () => {
    const d = draftFromReading(reading)!;
    expect(d).toMatchObject({ kind: "raid", attackerName: "Evil", attackerAlliance: "BAD", attackerX: 12, attackerY: -34, defenderX: 1, defenderY: 2, occurredText: "25.10.26 14:03" });
    expect(d.defenderLosses).toEqual([20, 1]);
    expect(draftFromReading({ ...reading, kind: "RALLY_POINT" })).toBeNull();
  });
  it("Spalten → Einheitennamen, Held in Spalte 11", () => {
    expect(namedUnits([3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1], (s) => `u${s}`)).toEqual([{ unit: "u1", count: 3 }, { unit: "u3", count: 1 }, { unit: "u11", count: 1 }]);
  });
  it("Eingaben: Einheitenzeilen, Koordinaten, Bedrohungsdauer", () => {
    expect(parseUnitLines("Keulenschwinger; 1.200\nquatsch\nAxt;0")).toEqual([{ unit: "Keulenschwinger", count: 1200 }]);
    expect(parseCoordText("(−39 | −28)")).toEqual({ x: -39, y: -28 });
    expect(parseCoordText("Evil")).toBeNull();
    expect(threatDays({ moreAttacks: "no", ongoing: "no", needHelp: "no" })).toBe(1);
    expect(threatDays({ moreAttacks: "unknown", ongoing: "no", needHelp: "no" })).toBe(3);
  });
});
