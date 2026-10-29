import { describe, expect, it } from "vitest";
import { computePlayerMetrics, diffSnapshots, type PopPoint } from "./analytics";
import type { MapRow } from "./mapsql/types";

const s = (...pops: number[]): PopPoint[] => pops.map((population, i) => ({ date: `2026-10-${String(10 + i).padStart(2, "0")}`, population }));

describe("computePlayerMetrics (4 Snapshots)", () => {
  it("active bei Zuwachs", () => {
    expect(computePlayerMetrics(s(100, 110, 120, 130), 3)).toMatchObject({ status: "active", noGrowthDays: 0, delta1: 10, delta3: 30, delta7: null });
  });
  it("stagnant: erst 1-2 Tage ohne Zuwachs", () => {
    expect(computePlayerMetrics(s(100, 110, 110, 110), 3)).toMatchObject({ status: "stagnant", noGrowthDays: 2 });
  });
  it("inactive ab INACTIVE_DAYS Snapshots ohne Zuwachs", () => {
    expect(computePlayerMetrics(s(100, 110, 110, 110, 110), 3)).toMatchObject({ status: "inactive", noGrowthDays: 3 });
    expect(computePlayerMetrics(s(100, 100, 100, 100), 3)).toMatchObject({ status: "inactive", noGrowthDays: 3 });
  });
  it("declining bei Rückgang", () => {
    expect(computePlayerMetrics(s(100, 120, 130, 90), 3)).toMatchObject({ status: "declining", noGrowthDays: 1, delta1: -40 });
  });
  it("Rückgang über viele Tage wird irgendwann inactive", () => {
    expect(computePlayerMetrics(s(200, 150, 100, 50), 3).status).toBe("inactive");
  });
  it("Zuwachs nach Pause setzt zurück", () => {
    expect(computePlayerMetrics(s(100, 100, 100, 105), 3)).toMatchObject({ status: "active", noGrowthDays: 0 });
  });
  it("kein/ein Datenpunkt: active ohne Deltas", () => {
    expect(computePlayerMetrics([], 3).status).toBe("active");
    expect(computePlayerMetrics(s(50), 3)).toMatchObject({ status: "active", delta1: null });
  });
  it("Lücken in den Daten: Delta nimmt den letzten Stand vor dem Zieltag", () => {
    const series: PopPoint[] = [
      { date: "2026-10-01", population: 100 },
      { date: "2026-10-08", population: 150 },
    ];
    expect(computePlayerMetrics(series, 3)).toMatchObject({ delta1: 50, delta3: 50, delta7: 50 });
  });
});

const row = (villageId: number, playerId: number, allianceId = 0): MapRow => ({
  fieldId: villageId, x: 0, y: 0, tribe: 1, villageId, villageName: `v${villageId}`, playerId, playerName: `p${playerId}`,
  allianceId, allianceName: allianceId ? "A" : "", population: 10, extra: {},
});

describe("diffSnapshots (4 synthetische Stände)", () => {
  const d1 = [row(1, 1, 5), row(2, 2, 5), row(3, 3)];
  const d2 = [row(1, 1, 5), row(2, 2, 5), row(3, 3), row(4, 1, 5)]; // neues Dorf
  const d3 = [row(1, 1, 5), row(2, 1, 5), row(3, 3, 9), row(4, 1, 5)]; // 2 erobert, 3 wechselt Allianz → 9; Spieler 2 hat kein Dorf mehr
  const d4 = [row(1, 1, 5), row(3, 3, 9)]; // 2 und 4 verloren
  it("neues Dorf", () => {
    expect(diffSnapshots(d1, d2)).toEqual([{ type: "village_new", villageId: 4, playerId: 1 }]);
  });
  it("erobert, Allianzwechsel, Spieler verschwunden", () => {
    const ev = diffSnapshots(d2, d3);
    expect(ev).toContainEqual({ type: "village_conquered", villageId: 2, playerId: 1, otherPlayerId: 2 });
    expect(ev).toContainEqual({ type: "alliance_change", playerId: 3, fromAllianceId: 0, toAllianceId: 9 });
    expect(ev).toContainEqual({ type: "player_gone", playerId: 2 });
    expect(ev).toHaveLength(3);
  });
  it("Dorf verloren", () => {
    const ev = diffSnapshots(d3, d4);
    expect(ev).toContainEqual({ type: "village_lost", villageId: 2, playerId: 1 });
    expect(ev).toContainEqual({ type: "village_lost", villageId: 4, playerId: 1 });
    expect(ev).toHaveLength(2);
  });
  it("identische Stände und Erstimport erzeugen keine Events", () => {
    expect(diffSnapshots(d1, d1)).toEqual([]);
    expect(diffSnapshots([], d1)).toEqual([]);
  });
});
