import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MapSqlParseError, parseMapSql } from "./parser";

const fixture = readFileSync(new URL("../../tests/fixtures/map.sample.sql", import.meta.url), "utf8");
const line = (name: string, extra = "NULL,TRUE,NULL,NULL,NULL") =>
  `INSERT INTO \`x_world\` VALUES (1,-5,7,3,10,'${name}',20,'Bob',36,'Human',123,${extra});`;

describe("parseMapSql (echte Fixture)", () => {
  const rows = parseMapSql(fixture);
  it("parst jede Zeile", () => {
    expect(rows.length).toBe(fixture.trim().split("\n").length);
  });
  it("liest Kernspalten", () => {
    const natars = rows.find((r) => r.playerName === "Natars")!;
    expect(natars).toMatchObject({ playerId: 1, tribe: 5, allianceId: 0, allianceName: "" });
    expect(natars.extra).toEqual({ region: null, isCapital: false, isCity: null, hasHarbor: null, victoryPoints: null });
  });
  it("behandelt Kommas, Unicode, Backticks und Akzente in Namen", () => {
    const names = rows.map((r) => r.villageName);
    expect(names).toContain("Alex, we need a name");
    expect(names.some((n) => /[Ѐ-ӿ]/.test(n))).toBe(true);
    expect(names.some((n) => n.includes("`"))).toBe(true);
    expect(names.some((n) => n.includes("´"))).toBe(true);
  });
  it("kennt die Allianz Human (id 36)", () => {
    expect(rows.filter((r) => r.allianceId === 36).every((r) => r.allianceName === "Human")).toBe(true);
  });
});

describe("parseMapSql (Sonderfälle)", () => {
  it("unescaped doppelte und Backslash-Quotes", () => {
    const rows = parseMapSql(line("it''s \\'x\\' a\\\\b") + "\n");
    expect(rows[0]?.villageName).toBe("it's 'x' a\\b");
  });
  it("speichert unbekannte Zusatzspalten statt abzubrechen", () => {
    const r = parseMapSql(line("v", "NULL,TRUE,NULL,NULL,NULL,'foo',7"))[0]!;
    expect(r.extra).toMatchObject({ col16: "foo", col17: 7 });
  });
  it("akzeptiert nur die 11 Pflichtspalten", () => {
    const r = parseMapSql("INSERT INTO `x_world` VALUES (1,2,3,1,4,'v',5,'p',0,'',9);")[0]!;
    expect(r.extra).toEqual({});
  });
  it("mehrere Tupel pro Statement", () => {
    const sql = "INSERT INTO `x_world` VALUES (1,2,3,1,4,'a',5,'p',0,'',9),(2,2,4,1,5,'b,)',5,'p',0,'',9);";
    expect(parseMapSql(sql).map((r) => r.villageName)).toEqual(["a", "b,)"]);
  });
  it("wirft bei kaputten Daten", () => {
    expect(() => parseMapSql("INSERT INTO `x_world` VALUES (1,2,3);")).toThrow(MapSqlParseError);
    expect(() => parseMapSql("INSERT INTO `x_world` VALUES (1,2,3,1,4,'abc);")).toThrow(MapSqlParseError);
    expect(() => parseMapSql("INSERT INTO `x_world` VALUES ('a',2,3,1,4,'v',5,'p',0,'',9);")).toThrow(MapSqlParseError);
  });
  it("leerer Input ergibt keine Zeilen", () => {
    expect(parseMapSql("")).toEqual([]);
  });
});
