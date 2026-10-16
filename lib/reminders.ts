import type { MessageKey, T } from "./i18n";

export const DEFAULT_STALE_DAYS = 2;

export type StateArea = "troops" | "resources" | "buildings";

export type VillageFreshness = {
  villageId: number;
  villageName: string;
  troopsAt: Date | null;
  resourcesAt: Date | null;
  buildingsAt: Date | null;
};

export type Reminder = { villageId: number; villageName: string; area: StateArea; ageDays: number | null };

/** `what`/`action` sind Übersetzungsschlüssel (Anzeige mit `t(...)`). */
export const AREA_LABEL: Record<StateArea, { what: MessageKey; action: MessageKey; upload: string }> = {
  troops: { what: "err.reminder.troopsWhat", action: "err.reminder.troopsAction", upload: "rally_point" },
  resources: { what: "err.reminder.resourcesWhat", action: "err.reminder.resourcesAction", upload: "resource_view" },
  buildings: { what: "err.reminder.buildingsWhat", action: "err.reminder.buildingsAction", upload: "village_view" },
};

const DAY = 86_400_000;

/** „X Tage“ als ganze Tage (abgerundet); null bei nie aktualisiert. */
export const ageInDays = (at: Date | null, now: Date) => (at ? Math.floor((now.getTime() - at.getTime()) / DAY) : null);

/**
 * Bereiche, die älter als `thresholdDays` sind (oder noch nie aktualisiert wurden), sortiert nach Alter (nie > älteste zuerst).
 * Läuft auch auf Leerdaten: ohne Dörfer gibt es keine Erinnerungen.
 */
export function staleReminders(villages: VillageFreshness[], thresholdDays: number, now = new Date()): Reminder[] {
  const out: Reminder[] = [];
  for (const v of villages) {
    for (const [area, at] of [["troops", v.troopsAt], ["resources", v.resourcesAt], ["buildings", v.buildingsAt]] as const) {
      const age = ageInDays(at, now);
      if (age === null || age >= thresholdDays) out.push({ villageId: v.villageId, villageName: v.villageName, area, ageDays: age });
    }
  }
  return out.sort((a, b) => (b.ageDays ?? Infinity) - (a.ageDays ?? Infinity) || a.villageName.localeCompare(b.villageName));
}

/** „vor 3 Tagen“ / „heute“ / „gestern“ / „noch nie“ (bzw. englisch) */
export function ageLabel(age: number | null, t: T): string {
  if (age === null) return t("err.reminder.never");
  if (age <= 0) return t("err.reminder.today");
  if (age === 1) return t("err.reminder.yesterday");
  return t("err.reminder.daysAgo", { n: age });
}
