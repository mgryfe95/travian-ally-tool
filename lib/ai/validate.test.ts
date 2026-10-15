import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiSchema, apiToReading, parseNum, readingJsonSchema, readingSchema, readingToApi, type Reading } from "./reading";
import { agreementOf, assess } from "./validate";

const dir = join(__dirname, "../../tests/fixtures/screenshots");
const golds = readdirSync(dir).filter((f) => f.endsWith(".gold.json"));
const known = [
  { id: 1, name: "MG Ryfe", x: -3, y: -82 },
  { id: 2, name: "OG Ryfe", x: -7, y: -82 },
  { id: 3, name: "MG", x: -3, y: -83 },
  { id: 4, name: "OG", x: -4, y: -81 },
];
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Reading;

describe("Gold-Beispiele", () => {
  it("gibt es", () => expect(golds.length).toBeGreaterThanOrEqual(10));
  for (const f of golds) {
    it(`${f}: gültiges Schema und keine harten Fehler`, () => {
      const r = readingSchema.parse(load(f));
      const a = assess(r, known);
      expect(a.issues.filter((i) => i.level === "hard")).toEqual([]);
      expect(a.confidence).toBeGreaterThan(0.85);
    });
  }
});

describe("Prüfungen", () => {
  const res = () => load("stats-resources-mobile-en.gold.json");
  it("Eigene Truppen: Summenzeile stimmt (inkl. Held)", () => {
    const r = load("stats-troops-own-desktop-de.gold.json");
    r.rows[1]!.cells[0] = 5;
    expect(assess(r, known).issues.some((i) => i.message.startsWith("Summe Spalte 1"))).toBe(true);
  });
  it("verlesene Produktionsziffer fällt über die Summenzeile auf", () => {
    const r = res();
    r.rows[0]!.cells[4] = 2388;
    const a = assess(r, known);
    expect(a.issues.some((i) => i.level === "hard" && i.message.startsWith("Summe"))).toBe(true);
    expect(a.confidence).toBeLessThan(0.5);
  });
  it("falsche Spaltenzahl und fremde Dörfer werden gemeldet", () => {
    const r = res();
    r.rows[1]!.cells.pop();
    expect(assess(r, known).issues.some((i) => i.message.includes("Spalten"))).toBe(true);
    expect(assess(res(), [known[0]!]).issues.some((i) => i.message.includes("gehört nicht"))).toBe(true);
  });
  it("Unsicherheit und Selbstauskunft senken die Konfidenz", () => {
    const r = res();
    r.uncertain = ["Zeile 3 schwer lesbar"];
    r.selfRating = 0.6;
    expect(assess(r, known).confidence).toBeLessThanOrEqual(0.6);
  });
  it("Konsens zweier Durchläufe", () => {
    const a = res();
    const b = res();
    expect(agreementOf(a, b)).toBe(1);
    b.rows[2]!.cells[0] = 999;
    expect(agreementOf(a, b)).toBeLessThan(1);
    expect(assess(a, known, agreementOf(a, b)).confidence).toBeLessThan(assess(a, known).confidence + 1e-9);
  });
  it("UNKNOWN ist nie sicher", () => {
    const r = res();
    r.kind = "UNKNOWN";
    expect(assess(r, known).confidence).toBeLessThan(0.5);
  });
});

describe("API-Schema", () => {
  it("hat keine Union-Typen (Limit der Structured Outputs: 16)", () => {
    const text = JSON.stringify(readingJsonSchema);
    expect((text.match(/"anyOf"|"oneOf"|"type":\[/g) ?? []).length).toBe(0);
  });
  it("parseNum", () => {
    expect([parseNum("13,956"), parseNum("13.956"), parseNum("−2334"), parseNum("+1,695"), parseNum("-"), parseNum(""), parseNum("12"), parseNum("2.519")]).toEqual([13956, 13956, -2334, 1695, null, null, 12, 2519]);
  });
  for (const f of golds) {
    it(`${f}: Gold → API-Format → Lesung ist verlustfrei`, () => {
      const gold = readingSchema.parse(load(f));
      const api = apiSchema.parse(JSON.parse(JSON.stringify(readingToApi(gold))));
      const back = apiToReading(api);
      expect(back.rows.map((r) => [r.x, r.y, r.cells.length])).toEqual(gold.rows.map((r) => [r.x, r.y, r.cells.length]));
      expect(back.rows.map((r) => r.cells)).toEqual(gold.rows.map((r) => r.cells));
      expect(back.totals?.cells ?? null).toEqual(gold.totals?.cells ?? null);
      expect(back.fields.map((x) => x.level)).toEqual(gold.fields.map((x) => x.level));
      expect(back.buildings.map((x) => x.level)).toEqual(gold.buildings.map((x) => x.level));
      expect(back.topBar?.wood ?? null).toEqual(gold.topBar?.wood ?? null);
    });
  }
});
