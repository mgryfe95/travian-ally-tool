"use client";

import { useMemo, useState, type ReactNode } from "react";

export type SortCol = { label: ReactNode; align?: "r"; sortable?: boolean };
export type SortRow = { key: string; cells: ReactNode[]; sort: (string | number | null)[] };

/** Tabelle mit Sortierung per Klick auf den Spaltenkopf (erneuter Klick dreht die Richtung). Zellen kommen fertig gerendert vom Server. */
export function SortTable({ cols, rows, minWidth, initial }: { cols: SortCol[]; rows: SortRow[]; minWidth?: number; initial?: { col: number; dir: 1 | -1 } }) {
  const [sort, setSort] = useState(initial ?? { col: -1, dir: 1 as 1 | -1 });
  const sorted = useMemo(() => {
    if (sort.col < 0) return rows;
    const v = (r: SortRow) => r.sort[sort.col];
    return [...rows].sort((a, b) => {
      const x = v(a), y = v(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true })) * sort.dir;
    });
  }, [rows, sort]);
  return (
    <table style={minWidth ? { minWidth } : undefined}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i} className={c.align} aria-sort={sort.col === i ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
              {c.sortable === false ? c.label : (
                <button type="button" onClick={() => setSort((s) => ({ col: i, dir: s.col === i ? (-s.dir as 1 | -1) : 1 }))}
                  style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "inherit", cursor: "pointer", textTransform: "inherit", letterSpacing: "inherit" }}>
                  {c.label}{sort.col === i ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </button>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{sorted.map((r) => <tr key={r.key}>{r.cells.map((c, i) => <td key={i} className={cols[i]?.align}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}
