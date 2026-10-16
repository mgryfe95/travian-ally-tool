import type { PrismaClient } from "@prisma/client";
import { translate, type Locale, type MessageKey } from "../i18n";
import { effectLabelKey, levelBenefits, rowsToEffects } from "./effects";

/** Gebäudenamen der aktuellen Spieldaten in der UI-Sprache (für Auswahllisten). */
export async function loadBuildingNames(db: PrismaClient, locale: Locale): Promise<string[]> {
  const rows = await db.building.findMany({ select: { name: true, nameEn: true, gid: true }, orderBy: { gid: "asc" } });
  return [...new Set(rows.map((r) => (locale === "en" ? (r.nameEn ?? r.name) : r.name)).filter(Boolean))];
}

export type BuildingInfo = { benefit: string; nextCost: string; benefitAfter: string; maxed: boolean };

/**
 * Nutzen und Kosten aus den Spieldaten für erkannte Gebäude (Zuordnung über den Namen, deutsch oder englisch).
 * Ergebnis je Listenindex; ohne passenden Namen fehlt der Eintrag.
 */
export async function buildingInfos(db: PrismaClient, entries: { name?: string | null; level: number }[], locale: Locale, fmtNum: (n: number) => string): Promise<Map<number, BuildingInfo>> {
  const out = new Map<number, BuildingInfo>();
  const wanted = [...new Set(entries.map((e) => e.name?.trim().toLowerCase()).filter((n): n is string => !!n))];
  if (wanted.length === 0) return out;
  const all = await db.building.findMany({ select: { id: true, name: true, nameEn: true, maxLevel: true } });
  const byName = new Map<string, (typeof all)[number]>();
  for (const b of all) for (const n of [b.name, b.nameEn]) if (n) byName.set(n.trim().toLowerCase(), b);
  for (const [i, e] of entries.entries()) {
    const b = e.name ? byName.get(e.name.trim().toLowerCase()) : undefined;
    if (!b) continue;
    const rows = await db.buildingLevel.findMany({ where: { buildingId: b.id, level: { gte: Math.max(0, e.level - 1), lte: e.level + 1 } }, orderBy: { level: "asc" }, include: { effectRows: true } });
    const levels = rows.map((l) => ({ ...l, effects: rowsToEffects(l.effectRows) }));
    const show = (lvl: number) => levelBenefits(levels, lvl, locale).filter((x) => x.kind !== "count" || x.value > 0).map((x) => `${translate(locale, effectLabelKey(x.id) as MessageKey)}: ${x.display}`).join(" · ");
    const next = levels.find((l) => l.level === e.level + 1);
    out.set(i, {
      benefit: show(e.level) || "–", maxed: e.level >= b.maxLevel,
      nextCost: next ? `${fmtNum(next.costWood)} / ${fmtNum(next.costClay)} / ${fmtNum(next.costIron)} / ${fmtNum(next.costCrop)}` : "–",
      benefitAfter: next ? show(e.level + 1) || "–" : "–",
    });
  }
  return out;
}
