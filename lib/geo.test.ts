import { describe, expect, it } from "vitest";
import { distance, roundFields } from "./geo";

describe("distance", () => {
  it("einfache Entfernung", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
  it("Wrap über die Ost-West-Kante: -200 und 200 sind Nachbarn", () => {
    expect(distance({ x: -200, y: 0 }, { x: 200, y: 0 })).toBe(1);
  });
  it("Wrap über beide Achsen", () => {
    expect(distance({ x: -200, y: -200 }, { x: 200, y: 200 })).toBeCloseTo(Math.SQRT2);
  });
  it("kürzester Weg wird gewählt, nicht der direkte", () => {
    expect(distance({ x: -190, y: 0 }, { x: 190, y: 0 })).toBe(21);
  });
  it("ist symmetrisch", () => {
    const a = { x: -150, y: 80 };
    const b = { x: 170, y: -190 };
    expect(distance(a, b)).toBe(distance(b, a));
  });
  it("rundet auf eine Nachkommastelle", () => {
    expect(roundFields(distance({ x: 0, y: 0 }, { x: 1, y: 1 }))).toBe(1.4);
  });
});
