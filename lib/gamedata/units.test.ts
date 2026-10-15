import { describe, expect, it } from "vitest";
import { mergeLanguages, parseUnitTables, UnitsError } from "./units";

// Synthetische Struktur nach dem Muster des Artikels – keine echten Spielwerte.
const table = (heads: string[]) => `<table><tr><th>Stat</th>${heads.map((h) => `<th>${h}</th>`).join("")}</tr><tr><td>Attack</td>${heads.map(() => "<td>1</td>").join("")}</tr></table>`;
const page = (items: [string, string[]][]) => `<html><script>var x=1</script><h1>Titel</h1>${items.map(([n, h]) => `<h2>${n}</h2>${table(h)}`).join("")}</html>`;

describe("Einheitennamen aus dem Support-Artikel", () => {
  const en = page([["Romans", ["Legionnaire", "Legionnaire (Northern Legends)", "Praetorian", "Imperian", "Equites Legati", "Equites Imperatoris", "Equites Caesaris"]], ["Gauls", ["Phalanx", "Swordsman", "Pathfinder", "Theutates Thunder", "Druidrider", "Haeduan"]], ["Nonsense", ["a", "b", "c", "d"]]]);
  it("liest Namen je Volk in Spielreihenfolge; Klammer-Varianten bekommen keinen Platz; Nicht-Völker werden ignoriert", () => {
    const r = parseUnitTables(en);
    expect(r.map((t) => t.vid)).toEqual([1, 3]);
    expect(r[0]!.units.map((u) => u.name)).toEqual(["Legionnaire", "Praetorian", "Imperian", "Equites Legati", "Equites Imperatoris", "Equites Caesaris"]);
    expect(r[0]!.units.map((u) => u.slot)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r[0]!.variants).toEqual(["Legionnaire (Northern Legends)"]);
  });
  it("führt EN und DE zusammen; ungleiche Anzahl wird abgelehnt", () => {
    const de = page([["Römer", ["Legionär", "Legionär (Nordlegenden)", "Prätorianer", "Imperianer", "Equites Legati", "Equites Imperatoris", "Equites Caesaris"]], ["Gallier", ["Phalanx", "Schwertkämpfer", "Späher", "Theutates Blitz", "Druidenreiter", "Haeduaner"]]]);
    const rows = mergeLanguages(parseUnitTables(en), parseUnitTables(de));
    expect(rows.find((x) => x.tribeVid === 3 && x.slot === 3)).toMatchObject({ nameEn: "Pathfinder", nameDe: "Späher" });
    const short = page([["Römer", ["a", "b", "c", "d", "e"]], ["Gallier", ["Phalanx", "Schwertkämpfer", "Späher", "Theutates Blitz", "Druidenreiter", "Haeduaner"]]]);
    expect(() => mergeLanguages(parseUnitTables(en), parseUnitTables(short))).toThrow(UnitsError);
  });
  it("lehnt veränderte Seitenstruktur ab", () => {
    expect(() => parseUnitTables("<html>nichts</html>")).toThrow(/Keine Völker-Tabellen/);
  });
});
