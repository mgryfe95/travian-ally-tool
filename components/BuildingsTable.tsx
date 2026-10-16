"use client";

import { useT } from "@/lib/i18n/client";

export type BuildingRow = { slot: number | null; name?: string | null; level: number };

/** Tabelle zum Korrigieren erkannter Gebäude bzw. Rohstofffelder: Platz, Name (Auswahl aus den Spieldaten oder frei), Stufe. */
export function BuildingsTable({ rows, onChange, names, withName = true, slots }: { rows: BuildingRow[]; onChange: (rows: BuildingRow[]) => void; names: string[]; withName?: boolean; slots?: number[] }) {
  const t = useT();
  const set = (i: number, patch: Partial<BuildingRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const missing = (slots ?? []).filter((n) => !rows.some((r) => r.slot === n));
  return (
    <div className="scroll">
      <table style={{ minWidth: withName ? 460 : 260 }}>
        <thead><tr><th style={{ width: 80 }}>{t("table.slot")}</th>{withName && <th>{t("table.building")}</th>}<th style={{ width: 90 }}>{t("table.level")}</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input type="number" min={1} max={40} className="field" style={{ minHeight: 34 }} aria-label={t("table.slot")} value={r.slot ?? ""} onChange={(e) => set(i, { slot: e.target.value === "" ? null : Number(e.target.value) })} /></td>
              {withName && <td>
                <select className="field" style={{ minHeight: 34 }} aria-label={t("table.building")} value={r.name ?? ""} onChange={(e) => set(i, { name: e.target.value || null })}>
                  <option value="">{t("table.namePh")}</option>
                  {r.name && !names.includes(r.name) && <option value={r.name}>{r.name}</option>}
                  {names.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </td>}
              <td><input type="number" min={0} max={30} className="field" style={{ minHeight: 34 }} aria-label={t("table.level")} value={r.level} onChange={(e) => set(i, { level: Number(e.target.value) })} /></td>
              <td className="r"><button type="button" className="btn ghost sm" aria-label={t("table.remove")} onClick={() => onChange(rows.filter((_, k) => k !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 6, gap: 8 }}>
        <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, { slot: null, name: null, level: 0 }])}>{t("table.add")}</button>
        {missing.length > 0 && <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, ...missing.map((n) => ({ slot: n, name: null, level: 0 }))].sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99)))}>{t("table.fillSlots", { n: missing.length })}</button>}
      </div>
    </div>
  );
}
