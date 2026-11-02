import type { PrismaClient } from "@prisma/client";
import type { Locale, T } from "./i18n";

/**
 * Anzeigenamen von Truppen je UI-Sprache. Gespeichert wird beim Übernehmen eines Screenshots der deutsche Name (oder „Einheit N“);
 * zur Anzeige wird er über die Einheitennamen-Tabelle (`UnitName`: Volk × Platz, DE/EN) in die Sprache des Nutzers übersetzt.
 */
export type UnitLabels = { byName: Map<string, { en: string; de: string }> };

export async function loadUnitLabels(db: Pick<PrismaClient, "unitName">): Promise<UnitLabels> {
  const rows = await db.unitName.findMany({ orderBy: [{ tribeVid: "asc" }, { slot: "asc" }] });
  const byName = new Map<string, { en: string; de: string }>();
  for (const r of rows) {
    const pair = { en: r.nameEn, de: r.nameDe ?? r.nameEn };
    for (const n of [r.nameEn, r.nameDe]) if (n && !byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), pair);
  }
  return { byName };
}

export function unitLabel(labels: UnitLabels, raw: string, locale: Locale, t: T): string {
  const s = raw.trim();
  if (/^(held|hero)$/i.test(s)) return t("common.hero");
  const slot = /^(?:einheit|unit) (\d+)$/i.exec(s);
  if (slot) return t("common.unitN", { n: slot[1]! });
  const hit = labels.byName.get(s.toLowerCase());
  return hit ? hit[locale] : s;
}
