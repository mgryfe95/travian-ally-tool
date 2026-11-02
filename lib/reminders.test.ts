import { describe, expect, it } from "vitest";
import { ageInDays, ageLabel, fieldsMaxed, staleReminders, type VillageFreshness } from "./reminders";
import { makeT } from "./i18n";

const de = makeT("de");
const en = makeT("en");

const now = new Date("2026-10-14T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000 - 1000);
const v = (o: Partial<VillageFreshness> & { villageId: number }): VillageFreshness => ({ villageName: `V${o.villageId}`, troopsAt: now, resourcesAt: now, buildingsAt: now, ...o });

describe("staleReminders", () => {
  it("nur Bereiche ab Schwelle; älteste zuerst", () => {
    const r = staleReminders([v({ villageId: 1, troopsAt: ago(3) }), v({ villageId: 2, resourcesAt: ago(4), buildingsAt: ago(6) }), v({ villageId: 3, troopsAt: ago(1) })], 2, now);
    expect(r.map((x) => [x.villageId, x.area, x.ageDays])).toEqual([[2, "buildings", 6], [2, "resources", 4], [1, "troops", 3]]);
  });
  it("Schwelle ist konfigurierbar", () => {
    expect(staleReminders([v({ villageId: 1, troopsAt: ago(3) })], 5, now)).toEqual([]);
    expect(staleReminders([v({ villageId: 1, troopsAt: ago(3) })], 3, now)).toHaveLength(1);
  });
  it("nie aktualisiert zählt als veraltet und steht ganz oben", () => {
    const r = staleReminders([v({ villageId: 1, troopsAt: ago(9) }), v({ villageId: 2, resourcesAt: null })], 2, now);
    expect(r[0]).toMatchObject({ villageId: 2, area: "resources", ageDays: null });
  });
  it("Leerdaten: keine Dörfer → keine Erinnerungen („Alles aktuell“)", () => {
    expect(staleReminders([], 2, now)).toEqual([]);
  });
  it("Alterslabel", () => {
    expect([ageInDays(ago(0), now), ageInDays(ago(3), now), ageInDays(null, now)]).toEqual([0, 3, null]);
    expect([ageLabel(0, de), ageLabel(1, de), ageLabel(3, de), ageLabel(null, de)]).toEqual(["heute", "gestern", "vor 3 Tagen", "noch nie"]);
    expect([ageLabel(0, en), ageLabel(1, en), ageLabel(3, en), ageLabel(null, en)]).toEqual(["today", "yesterday", "3 days ago", "never"]);
  });
});

describe("Rohstofffelder fertig ausgebaut", () => {
  const ten = Array.from({ length: 18 }, (_, i) => ({ slot: i + 1, level: 10 }));
  it("alle 18 Felder auf 10 und keine Hauptstadt → keine Rohstoff-Erinnerung; Hauptstadt erinnert weiter", () => {
    expect(fieldsMaxed(ten, { isCapital: false })).toBe(true);
    expect(fieldsMaxed(ten, { isCapital: true })).toBe(false);
    expect(fieldsMaxed(ten, { isCapital: "TRUE" })).toBe(false);
    expect(fieldsMaxed(ten.map((f, i) => (i === 3 ? { ...f, level: 9 } : f)), {})).toBe(false);
    expect(fieldsMaxed(ten.slice(1), {})).toBe(false);
    expect(fieldsMaxed(null, {})).toBe(false);
    const v = { villageId: 1, villageName: "A", troopsAt: null, resourcesAt: null, buildingsAt: null };
    expect(staleReminders([{ ...v, resourcesDone: true }], 2).map((r) => r.area)).toEqual(["troops", "buildings"]);
    expect(staleReminders([v], 2).map((r) => r.area).sort()).toEqual(["buildings", "resources", "troops"]);
  });
});
