"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { BuildingsTable, type BuildingRow } from "./BuildingsTable";

/** Dorfseite: Gebäude von Hand korrigieren; das Formular schickt die Liste als JSON an die Server-Aktion. */
export function BuildingsEditor({ villageId, initial, names, action }: { villageId: number; initial: BuildingRow[]; names: string[]; action: (f: FormData) => void | Promise<void> }) {
  const t = useT();
  const [rows, setRows] = useState<BuildingRow[]>(initial);
  return (
    <details style={{ margin: "0 12px 12px" }}>
      <summary className="btn ghost sm" style={{ display: "inline-flex" }}>{t("villages.bld.edit")}</summary>
      <form action={action} style={{ marginTop: 10 }}>
        <input type="hidden" name="villageId" value={villageId} />
        <input type="hidden" name="data" value={JSON.stringify(rows)} />
        <p className="sub" style={{ fontSize: 12, marginBottom: 8 }}>{t("villages.bld.editHint")}</p>
        <BuildingsTable rows={rows} onChange={setRows} names={names} slots={Array.from({ length: 22 }, (_, i) => 19 + i)} />
        <div className="row" style={{ marginTop: 8 }}><button className="btn sm">{t("villages.bld.save")}</button></div>
      </form>
    </details>
  );
}
