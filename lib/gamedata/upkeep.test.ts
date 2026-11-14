import { describe, expect, it } from "vitest";
import { troopUpkeep, upkeepOf } from "./upkeep";

describe("Getreideverbrauch", () => {
  const names = new Map([["legionär", 1], ["equites caesaris", 6]]);
  it("je Platz, Name oder Held", () => {
    expect(upkeepOf(1, "Einheit 4", names)).toBe(2);
    expect(upkeepOf(1, "Equites Caesaris", names)).toBe(4);
    expect(upkeepOf(1, "Held", names)).toBe(6);
    expect(upkeepOf(8, "Einheit 1", names)).toBeNull();
  });
  it("summiert und zählt Unbekannte", () => {
    expect(troopUpkeep(1, [{ unit: "Legionär", count: 100 }, { unit: "Einheit 8", count: 2 }, { unit: "Unbekannt", count: 5 }], names)).toEqual({ total: 112, unknown: 5 });
  });
});
