import { describe, expect, it } from "vitest";
import { parseTroopsText, readTroops, sumTroops, TroopsError, troopsToText } from "./troops";

describe("parseTroopsText", () => {
  it("Trennzeichen, Tausenderpunkte, fehlende Zahlen, Summieren gleicher Einheiten", () => {
    expect(parseTroopsText("Axtkämpfer; 3.410; 600\nKatapult|0\nAxtkämpfer\t10;;5\n\n  ")).toEqual([
      { unit: "Axtkämpfer", inVillage: 3420, away: 600, support: 5 },
      { unit: "Katapult", inVillage: 0, away: 0, support: 0 },
    ]);
  });
  it("lehnt ungültige Eingaben mit Zeilennummer ab", () => {
    expect(() => parseTroopsText("Axt; abc")).toThrow(/Zeile 1/);
    expect(() => parseTroopsText("Axt; -5")).toThrow(TroopsError);
    expect(() => parseTroopsText("ok; 1\n; 5")).toThrow(/Zeile 2/);
    expect(() => parseTroopsText("a;1;2;3;4")).toThrow(/zu viele/);
    expect(() => parseTroopsText("x".repeat(41) + ";1")).toThrow(TroopsError);
  });
  it("Rundreise Text ↔ Daten", () => {
    const e = parseTroopsText("A;1;2;3\nB;4;5;6");
    expect(parseTroopsText(troopsToText(e))).toEqual(e);
  });
  it("max. 60 Einheiten", () => {
    expect(() => parseTroopsText(Array.from({ length: 61 }, (_, i) => `E${i};1`).join("\n"))).toThrow(/Maximal/);
  });
});

describe("readTroops / sumTroops", () => {
  it("liest defekte JSON-Daten defensiv", () => {
    expect(readTroops(null)).toEqual([]);
    expect(readTroops([{ unit: "A", inVillage: 5 }, { foo: 1 }, { unit: "B", inVillage: -3, away: "x" }])).toEqual([
      { unit: "A", inVillage: 5, away: 0, support: 0 }, { unit: "B", inVillage: 0, away: 0, support: 0 },
    ]);
  });
  it("Summe über Dörfer, Gesamt = im Dorf + unterwegs, absteigend", () => {
    const s = sumTroops([[{ unit: "Axt", inVillage: 100, away: 10, support: 5 }], [{ unit: "axt", inVillage: 50, away: 0, support: 1 }, { unit: "Ram", inVillage: 500, away: 0, support: 0 }]]);
    expect(s).toEqual([
      { unit: "Ram", inVillage: 500, away: 0, support: 0, total: 500 },
      { unit: "Axt", inVillage: 150, away: 10, support: 6, total: 160 },
    ]);
  });
});
