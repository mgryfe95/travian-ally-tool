import { INTL_TAG, type Locale } from "../i18n";

/**
 * Einheitliche Beschreibung der Gebäude-Vorteile (Quelle: `effects` je Stufe). Jeder Vorteil hat eine Art (`kind`), die Einheit und
 * Darstellung festlegt – so sind so verschiedene Dinge wie Produktion, Lagerkapazität, Verstecke oder Bauzeit-Faktoren für Menschen
 * (Tabelle, Δ je Stufe) und KI (`levelBenefits`, `benefitsMarkdown`) gleich lesbar und vergleichbar.
 *
 * - rate: Menge pro Stunde · capacity: Menge (Lager, Versteck) · count: ganze Zahl (Händler, Fallen, Plätze) · seconds: Dauer
 * - bonus: Anteil als Zuwachs (0,05 → +5 %) · timeFactor: Zeitfaktor (0,9 → −10 % Zeit; kleiner ist besser)
 */
export type EffectKind = "rate" | "capacity" | "count" | "seconds" | "bonus" | "timeFactor";
export type EffectGroup = "production" | "storage" | "time" | "military" | "defense" | "economy" | "culture" | "info";
export type EffectDef = { kind: EffectKind; group: EffectGroup; better: "higher" | "lower" };

const H = "higher" as const;
const L = "lower" as const;
export const EFFECTS: Record<string, EffectDef> = {
  production1: { kind: "rate", group: "production", better: H }, production2: { kind: "rate", group: "production", better: H },
  production3: { kind: "rate", group: "production", better: H }, production4: { kind: "rate", group: "production", better: H },
  productionBoost1: { kind: "bonus", group: "production", better: H }, productionBoost2: { kind: "bonus", group: "production", better: H },
  productionBoost3: { kind: "bonus", group: "production", better: H }, productionBoost4: { kind: "bonus", group: "production", better: H },
  oasisBoost: { kind: "bonus", group: "production", better: H },
  storageWarehouse: { kind: "capacity", group: "storage", better: H }, storageGranary: { kind: "capacity", group: "storage", better: H },
  storageCranny: { kind: "capacity", group: "storage", better: H }, storageCrannyGaul: { kind: "capacity", group: "storage", better: H },
  buildingTime: { kind: "timeFactor", group: "time", better: L }, trainingTimeBarracks: { kind: "timeFactor", group: "time", better: L },
  trainingTimeStable: { kind: "timeFactor", group: "time", better: L }, trainingTimeWorkshop: { kind: "timeFactor", group: "time", better: L },
  trainingTimeResidence: { kind: "timeFactor", group: "time", better: L }, healTime: { kind: "timeFactor", group: "time", better: L },
  troopSpeedBoost: { kind: "bonus", group: "military", better: H }, offBoost: { kind: "bonus", group: "military", better: H },
  troopVisibility: { kind: "count", group: "military", better: H }, traps: { kind: "count", group: "military", better: H },
  slots: { kind: "count", group: "military", better: H }, oases: { kind: "count", group: "military", better: H },
  defBonus: { kind: "bonus", group: "defense", better: H }, defFlat: { kind: "count", group: "defense", better: H },
  durability: { kind: "bonus", group: "defense", better: H },
  merchants: { kind: "count", group: "economy", better: H }, merchantBoost: { kind: "bonus", group: "economy", better: H },
  merchantBoostRoman: { kind: "bonus", group: "economy", better: H }, ships: { kind: "count", group: "economy", better: H },
  smallPartyTime: { kind: "seconds", group: "economy", better: L }, largePartyTime: { kind: "seconds", group: "economy", better: L },
  partyTime: { kind: "seconds", group: "economy", better: L },
  culturePoints: { kind: "count", group: "culture", better: H },
  population: { kind: "count", group: "info", better: L },
};
/** Anzeigereihenfolge der Vorteile (Gruppe, dann Schlüssel wie oben). */
export const EFFECT_IDS = Object.keys(EFFECTS);
export const effectLabelKey = (id: string) => `overview.fx.${id}`;

export type Effects = unknown;

/** Relationale Zeilen (`BuildingLevelEffect`) → Objekt `{ effect: value }` für `levelBenefits` & Co. */
export const rowsToEffects = (rows: { effect: string; value: number }[]): Record<string, number> => Object.fromEntries(rows.map((r) => [r.effect, r.value]));
export const effectValue = (e: Effects, id: string): number | null => {
  const v = e && typeof e === "object" ? (e as Record<string, unknown>)[id] : undefined;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/** Effekt-Schlüssel, die für mindestens eine Stufe einen Wert haben – in fester Reihenfolge, unbekannte Schlüssel hinten. */
export function presentEffects(levels: { effects: Effects }[]): string[] {
  const seen = new Set<string>();
  for (const l of levels) for (const k of Object.keys(l.effects && typeof l.effects === "object" ? (l.effects as Record<string, unknown>) : {})) if (effectValue(l.effects, k) !== null) seen.add(k);
  return [...EFFECT_IDS.filter((k) => seen.has(k)), ...[...seen].filter((k) => !(k in EFFECTS)).sort()];
}

const num = (n: number, locale: Locale, max = 2) => n.toLocaleString(INTL_TAG[locale], { maximumFractionDigits: max });
const signed = (n: number, locale: Locale, max = 2) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${num(Math.abs(n), locale, max)}`;
const clock = (sec: number) => {
  const s = Math.round(Math.abs(sec));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const kindOf = (id: string): EffectKind => EFFECTS[id]?.kind ?? "count";

/** Wert eines Vorteils für die Anzeige: rate „7 /h“, bonus „+5 %“, timeFactor „−10 %“ (Zeit gegenüber Basis), seconds „h:mm:ss“. */
export function formatEffect(id: string, v: number | null, locale: Locale): string {
  if (v === null) return "–";
  switch (kindOf(id)) {
    case "rate": return `${num(v, locale)} /h`;
    case "bonus": return `${signed(v * 100, locale)} %`;
    case "timeFactor": return `${signed((v - 1) * 100, locale)} %`;
    case "seconds": return clock(v);
    default: return num(v, locale);
  }
}

/** Veränderung gegenüber der Vorstufe: Absolutwert (bei bonus/timeFactor in %-Punkten, bei seconds Dauer). */
export function formatDelta(id: string, prev: number | null, cur: number | null, locale: Locale): string | null {
  if (cur === null) return null;
  const base = prev ?? (kindOf(id) === "timeFactor" ? 1 : 0);
  const d = cur - base;
  if (Math.abs(d) < 1e-9) return null;
  switch (kindOf(id)) {
    case "rate": return `${signed(d, locale)} /h`;
    case "bonus": return `${signed(d * 100, locale)} pp`;
    case "timeFactor": return `${signed(d * 100, locale)} pp`;
    case "seconds": return `${d > 0 ? "+" : "−"}${clock(d)}`;
    default: return signed(d, locale, 0);
  }
}

export type Benefit = { id: string; group: EffectGroup; kind: EffectKind; better: "higher" | "lower"; value: number; display: string; delta: string | null; deltaValue: number };
type LevelRow = { level: number; costWood: number; costClay: number; costIron: number; costCrop: number; buildTimeSec: number; effects: Effects };

/** Normalisierte Vorteile einer Stufe (für KI und UI): `deltaValue` = Zuwachs ggü. Vorstufe in Rohwert-Einheit des Vorteils. */
export function levelBenefits(levels: LevelRow[], level: number, locale: Locale = "en"): Benefit[] {
  const cur = levels.find((l) => l.level === level);
  if (!cur) return [];
  const prev = levels.filter((l) => l.level < level).sort((a, b) => b.level - a.level)[0];
  return presentEffects(levels).flatMap((id) => {
    const v = effectValue(cur.effects, id);
    if (v === null) return [];
    const p = prev ? effectValue(prev.effects, id) : null;
    const def = EFFECTS[id] ?? { kind: "count" as const, group: "info" as const, better: "higher" as const };
    return [{ id, group: def.group, kind: def.kind, better: def.better, value: v, display: formatEffect(id, v, locale), delta: formatDelta(id, p, v, locale), deltaValue: v - (p ?? (def.kind === "timeFactor" ? 1 : 0)) }];
  });
}

/** Kompakte Markdown-Tabelle (Stufe, Kosten, Bauzeit, Vorteile mit Δ) – Kontext für die KI, gleiche Einheiten wie die UI. */
export function benefitsMarkdown(name: string, levels: LevelRow[], speed: number, labels: (id: string) => string, locale: Locale = "en"): string {
  const ids = presentEffects(levels).filter((i) => i !== "population");
  const head = ["level", "wood", "clay", "iron", "crop", "build_time", ...ids.map(labels)];
  const rows = levels.map((l) => {
    const b = levelBenefits(levels, l.level, locale);
    return [String(l.level), l.costWood, l.costClay, l.costIron, l.costCrop, clock(l.buildTimeSec / speed), ...ids.map((id) => {
      const x = b.find((y) => y.id === id);
      return x ? `${x.display}${x.delta ? ` (${x.delta})` : ""}` : "–";
    })].join(" | ");
  });
  return [`### ${name}`, `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r} |`)].join("\n");
}
