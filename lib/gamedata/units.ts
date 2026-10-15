import { AppError } from "../i18n/errors";
/**
 * Einheitennamen je Volk aus dem Support-Artikel „Infantry and Cavalry Units comparison table“ (Travian: Legends Help Center).
 * Gelesen werden NUR die Namen (Spaltenköpfe in Spielreihenfolge). Kampfwerte, Kosten und Zeiten werden bewusst nicht übernommen: Die Quelle nennt
 * sie nur für Schmiede/Kaserne/Stall 20, nicht als Basiswerte; auch der „Crop“-Wert passt nicht zum Spiel (dort kostet jede Einheit 1 Getreide Unterhalt).
 */
export class UnitsError extends AppError {}

/** Völker-IDs wie in map.sql / Wissensdatenbank. */
export const TRIBE_VID: Record<string, number> = {
  romans: 1, "römer": 1, teutons: 2, germanen: 2, gauls: 3, gallier: 3, egyptians: 6, "ägypter": 6, huns: 7, hunnen: 7, spartans: 8, spartaner: 8, vikings: 9, wikinger: 9,
};

export type ParsedUnit = { slot: number; name: string };
export type ParsedTribe = { vid: number; units: ParsedUnit[]; variants: string[] };

const clean = (t: string) =>
  t.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

/** Alle Tabellen mit der jeweils nächsten vorangehenden Überschrift (Volksname). */
export function parseUnitTables(html: string): ParsedTribe[] {
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  const out: ParsedTribe[] = [];
  const tables = [...body.matchAll(/<table[\s\S]*?<\/table>/gi)];
  for (const t of tables) {
    const before = body.slice(0, t.index);
    const heads = [...before.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)];
    const name = clean(heads[heads.length - 1]?.[1] ?? "").toLowerCase();
    const vid = TRIBE_VID[name];
    if (!vid) continue;
    const rows = [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => clean(c[1] as string)));
    const header = rows[0];
    if (!header || header.length < 3) throw new UnitsError("err.units.noHeader", { name });
    // Spalte 0 ist die Zeilenbeschriftung; Spalten mit Klammerzusatz (z. B. „Legionnaire (Northern Legends)“) sind Varianten, keine Einheitenplätze
    const cols = header.map((h, i) => ({ h, i })).slice(1);
    const slotCols = cols.filter((c) => !/\(.+\)\s*$/.test(c.h));
    const variants = cols.filter((c) => /\(.+\)\s*$/.test(c.h)).map((c) => c.h);
    const units = slotCols.map((c, k) => ({ slot: k + 1, name: c.h }));
    if (units.length < 4 || units.length > 10) throw new UnitsError("err.units.unexpectedCount", { name, n: units.length });
    out.push({ vid, units, variants });
  }
  if (out.length === 0) throw new UnitsError("err.units.noTables");
  return out;
}

export type UnitNameRow = { tribeVid: number; slot: number; nameEn: string; nameDe: string | null };

/** Führt die englische und (optional) die deutsche Fassung zusammen; beide müssen je Volk gleich viele Einheiten haben. */
export function mergeLanguages(en: ParsedTribe[], de?: ParsedTribe[]): UnitNameRow[] {
  const rows: UnitNameRow[] = [];
  for (const t of en) {
    const d = de?.find((x) => x.vid === t.vid);
    if (de && !d) throw new UnitsError("err.units.notInDe", { vid: t.vid });
    if (d && d.units.length !== t.units.length) throw new UnitsError("err.units.countMismatch", { vid: t.vid, en: t.units.length, de: d.units.length });
    for (const u of t.units) {
      const du = d?.units[u.slot - 1];
      rows.push({ tribeVid: t.vid, slot: u.slot, nameEn: u.name, nameDe: du?.name ?? null });
    }
  }
  return rows;
}

/** Händisch gepflegte Ergänzungen (deutsche Namen, Plätze 7–10): { "<Volk-ID>": { "<Platz>": { "de": "…", "en": "…" } } }. Leere Namen werden ignoriert. */
export type NameOverrides = Record<string, Record<string, { de?: string; en?: string }>>;

export function applyOverrides(rows: UnitNameRow[], overrides: NameOverrides): UnitNameRow[] {
  const out = rows.map((r) => ({ ...r }));
  for (const [vidRaw, slots] of Object.entries(overrides)) {
    const vid = Number(vidRaw);
    if (!Object.values(TRIBE_VID).includes(vid)) throw new UnitsError("err.units.unknownTribe", { vid: vidRaw });
    for (const [slotRaw, v] of Object.entries(slots)) {
      const slot = Number(slotRaw);
      if (!Number.isInteger(slot) || slot < 1 || slot > 10) throw new UnitsError("err.units.badSlot", { vid, slot: slotRaw });
      const de = v.de?.trim() || null;
      const en = v.en?.trim() || null;
      if (!de && !en) continue;
      const row = out.find((r) => r.tribeVid === vid && r.slot === slot);
      if (row) {
        if (en && en !== row.nameEn) throw new UnitsError("err.units.nameConflict", { vid, slot, en, src: row.nameEn });
        if (de) row.nameDe = de;
      } else {
        if (!en) throw new UnitsError("err.units.nameRequired", { vid, slot });
        out.push({ tribeVid: vid, slot, nameEn: en, nameDe: de });
      }
    }
  }
  return out.sort((a, b) => a.tribeVid - b.tribeVid || a.slot - b.slot);
}

/** Vorlage zum Ausfüllen: alle Plätze 1–10 je Volk mit den englischen Namen aus der Quelle; deutsche Namen leer (Plätze 7–10 komplett leer). */
export function overridesTemplate(rows: UnitNameRow[], known: NameOverrides = {}): NameOverrides {
  const t: NameOverrides = {};
  for (const vid of [...new Set(rows.map((r) => r.tribeVid))]) {
    t[vid] = {};
    for (let slot = 1; slot <= 10; slot++) {
      const r = rows.find((x) => x.tribeVid === vid && x.slot === slot);
      t[vid]![slot] = { en: r?.nameEn ?? "", de: known[vid]?.[slot]?.de ?? r?.nameDe ?? "" };
    }
  }
  return t;
}
