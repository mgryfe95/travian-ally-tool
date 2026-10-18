import { describe, expect, it } from "vitest";
import { apiToReading, readingSchema, readingToApi, type ApiReading } from "./reading";

const api: ApiReading = {
  kind: "VILLAGE_VIEW", device: "MOBILE", language: "de", village: { name: "MG", coord: "-3|-83" },
  topBar: { present: false, wood: "", clay: "", iron: "", crop: "", freeCrop: "", warehouse: "", granary: "" }, rows: [], totals: { present: false, cells: [], texts: [] },
  fields: [{ slot: 1, level: 3, x: 0.25, y: 0.5 }, { slot: 2, level: 4, x: -1, y: -1 }],
  buildings: [{ slot: 0, name: "", level: 10, x: 1.2, y: 0.123456 }, { slot: 19, name: "Hauptgebäude", level: 5, x: 0.5, y: 0.75 }],
  selfRating: 0.9, uncertain: [],
};

describe("Positionen der Marken im Bild", () => {
  it("übernimmt relative Positionen 0–1, alles andere ist unbekannt (null)", () => {
    const r = apiToReading(api);
    expect(r.fields).toEqual([{ slot: 1, level: 3, x: 0.25, y: 0.5 }, { slot: 2, level: 4, x: null, y: null }]);
    expect(r.buildings[0]).toEqual({ slot: null, name: null, level: 10, x: null, y: 0.123 });
    expect(r.buildings[1]).toEqual({ slot: 19, name: "Hauptgebäude", level: 5, x: 0.5, y: 0.75 });
  });
  it("Hin- und Rückweg (Lern-Beispiele) erhält die Positionen; ältere Lesungen ohne x/y bleiben gültig", () => {
    const r = apiToReading(api);
    expect(readingToApi(r).fields[0]).toMatchObject({ x: 0.25, y: 0.5 });
    expect(readingToApi(r).fields[1]).toMatchObject({ x: -1, y: -1 });
    const old = { ...r, fields: [{ slot: 1, level: 2 }], buildings: [{ slot: null, name: null, level: 1 }] };
    expect(readingSchema.safeParse(old).success).toBe(true);
  });
});
