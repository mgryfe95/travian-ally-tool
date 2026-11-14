import { describe, expect, it } from "vitest";
import { parseCoord, searchInactive, type Candidate } from "./inactive";

const c = (o: Partial<Candidate> & { villageId: number }): Candidate => ({
  villageName: "v", x: 0, y: 0, villagePop: 5, delta7: 0, playerId: o.villageId, playerName: "p", playerPop: 100, tribe: 1,
  allianceId: 0, allianceName: "", status: "inactive", noGrowthDays: 5, ...o,
});

const data = [
  c({ villageId: 1, x: 10, y: 0 }),
  c({ villageId: 2, x: -200, y: 0 }), // Wrap: Entfernung 1 vom Ursprung (200,0)
  c({ villageId: 3, x: 100, y: 0, status: "active" }),
  c({ villageId: 4, x: 190, y: 0, playerPop: 500, tribe: 3, allianceId: 36, noGrowthDays: 9 }),
];
const origin = { x: 200, y: 0 };

describe("searchInactive", () => {
  it("Default: nur inactive, nach Entfernung aufsteigend inkl. Wrap", () => {
    const r = searchInactive(data, origin);
    expect(r.map((x) => x.villageId)).toEqual([2, 4, 1]);
    expect(r[0]?.distance).toBe(1);
  });
  it("Filter max. Entfernung / Bevölkerung / Tage / Allianz / Volk", () => {
    expect(searchInactive(data, origin, { maxDistance: 12 }).map((x) => x.villageId)).toEqual([2, 4]);
    expect(searchInactive(data, origin, { minPop: 200 }).map((x) => x.villageId)).toEqual([4]);
    expect(searchInactive(data, origin, { maxPop: 200 }).map((x) => x.villageId)).toEqual([2, 1]);
    expect(searchInactive(data, origin, { minDays: 9 }).map((x) => x.villageId)).toEqual([4]);
    expect(searchInactive(data, origin, { allianceId: 36 }).map((x) => x.villageId)).toEqual([4]);
    expect(searchInactive(data, origin, { tribe: 3 }).map((x) => x.villageId)).toEqual([4]);
  });
  it("Status wählbar, Sortierung wählbar", () => {
    expect(searchInactive(data, origin, { statuses: ["active", "inactive"], sort: "population" })[0]?.villageId).toBe(4);
    expect(searchInactive(data, origin, { sort: "days", dir: "asc" }).map((x) => x.villageId)).toEqual([2, 1, 4]);
  });
  it("blendet Allianzen (z. B. eigene Gruppe) aus", () => {
    expect(searchInactive(data, origin, { excludeAllianceIds: new Set([36]) }).map((x) => x.villageId)).toEqual([2, 1]);
  });
});

describe("parseCoord", () => {
  it("verschiedene Schreibweisen", () => {
    for (const t of ["(12|-34)", "12|-34", " 12 / -34 ", "12,-34"]) expect(parseCoord(t)).toEqual({ x: 12, y: -34 });
  });
  it("ungültig oder außerhalb der Karte", () => {
    expect(parseCoord("abc")).toBeUndefined();
    expect(parseCoord("(201|0)")).toBeUndefined();
    expect(parseCoord("")).toBeUndefined();
  });
});
