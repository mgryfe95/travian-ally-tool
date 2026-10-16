"use client";

import { useT } from "@/lib/i18n/client";

export type BuildingRow = { slot: number | null; name?: string | null; level: number };

/** Tabelle zum Korrigieren erkannter Gebäude bzw. Rohstofffelder: Platz, Name (Auswahl aus den Spieldaten oder frei), Stufe. */
export function BuildingsTable({ rows, onChange, names, withName = true, idPrefix = "bt" }: { rows: BuildingRow[]; onChange: (rows: BuildingRow[]) => void; names: string[]; withName?: boolean; idPrefix?: string }) {
  const t = useT();
  const set = (i: number, patch: Partial<BuildingRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const listId = `${idPrefix}-names`;
  return (
    <div className="scroll">
      {withName && <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist>}
      <table style={{ minWidth: withName ? 460 : 260 }}>
        <thead><tr><th style={{ width: 80 }}>{t("table.slot")}</th>{withName && <th>{t("table.building")}</th>}<th style={{ width: 90 }}>{t("table.level")}</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input type="number" min={1} max={40} className="field" style={{ minHeight: 34 }} aria-label={t("table.slot")} value={r.slot ?? ""} onChange={(e) => set(i, { slot: e.target.value === "" ? null : Number(e.target.value) })} /></td>
              {withName && <td><input list={listId} className="field" style={{ minHeight: 34 }} aria-label={t("table.building")} placeholder={t("table.namePh")} value={r.name ?? ""} onChange={(e) => set(i, { name: e.target.value || null })} /></td>}
              <td><input type="number" min={0} max={30} className="field" style={{ minHeight: 34 }} aria-label={t("table.level")} value={r.level} onChange={(e) => set(i, { level: Number(e.target.value) })} /></td>
              <td className="r"><button type="button" className="btn ghost sm" aria-label={t("table.remove")} onClick={() => onChange(rows.filter((_, k) => k !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => onChange([...rows, { slot: null, name: null, level: 0 }])}>{t("table.add")}</button>
    </div>
  );
}
