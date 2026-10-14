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

export const AREA_LABEL: Record<StateArea, { what: string; action: string; upload: string }> = {
  troops: { what: "die Truppen", action: "Versammlungsplatz hochladen", upload: "rally_point" },
  resources: { what: "die Ressourcen", action: "Ressourcenfelder hochladen", upload: "resource_view" },
  buildings: { what: "die Dorfansicht", action: "Dorfansicht hochladen", upload: "village_view" },
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

/** „vor 3 Tagen“ / „heute“ / „gestern“ / „noch nie“ */
export function ageLabel(age: number | null): string {
  if (age === null) return "noch nie";
  if (age <= 0) return "heute";
  if (age === 1) return "gestern";
  return `vor ${age} Tagen`;
}
