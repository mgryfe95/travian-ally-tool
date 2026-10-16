"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { READING_KINDS, type Reading } from "@/lib/ai/reading";
import { useT } from "@/lib/i18n/client";
import { BuildingsTable } from "./BuildingsTable";

const cellsToText = (cells: (number | null)[]) => cells.map((c) => (c === null ? "-" : String(c))).join(", ");
const textToCells = (s: string) => s.split(",").map((x) => x.trim()).filter((x) => x !== "").map((x) => (x === "-" ? null : Number(x.replace(",", "."))));

/** Lernmodus: erkannte Werte in Tabellen prüfen und korrigieren (Gebäude mit Name/Stufe, Felder, Zeilen), bestätigen → Dorfzustand und Lern-Beispiele. JSON nur im Expertenmodus. */
export function ScreenshotReview({ id, reading, issues, villages, defaultVillageId, nameSets, kindLabels, exampleId }: {
  id: number; reading: unknown; issues: { level: string; message: string }[]; villages: { id: number; label: string; tribe?: number }[]; defaultVillageId?: number; nameSets: { all: string[]; byTribe: Record<number, string[]> }; kindLabels: Record<string, string>; exampleId?: number;
}) {
  const router = useRouter();
  const t = useT();
  const [data, setData] = useState<Reading>(() => reading as Reading);
  const [text, setText] = useState("");
  const [expert, setExpert] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [village, setVillage] = useState(defaultVillageId ? String(defaultVillageId) : "");
  const [dirty, setDirty] = useState(false);
  const [asExample, setAsExample] = useState(true);
  const tribe = villages.find((v) => String(v.id) === village)?.tribe;
  const buildingNames = (tribe !== undefined ? nameSets.byTribe[tribe] : undefined) ?? nameSets.all;
  const upd = (patch: Partial<Reading>) => { setData((d) => ({ ...d, ...patch })); setDirty(true); };

  async function send(action: "confirm" | "reject") {
    setBusy(true);
    setMsg(undefined);
    let parsed: unknown;
    if (action === "confirm") {
      if (expert) {
        try {
          parsed = JSON.parse(text);
        } catch {
          setBusy(false);
          return setMsg(t("screenshots.review.badJson"));
        }
      } else if (dirty) parsed = data;
    }
    const res = await fetch(`/api/screenshots/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reading: parsed, villageId: village ? Number(village) : undefined, asExample }) });
    const out = (await res.json().catch(() => ({}))) as { error?: string; message?: string | null };
    setBusy(false);
    if (!res.ok) return setMsg(out.error ?? out.message ?? t("screenshots.review.failed"));
    router.refresh();
  }

  async function saveExample(remove: boolean) {
    setBusy(true);
    setMsg(undefined);
    let body: unknown = data;
    if (expert) {
      try {
        body = JSON.parse(text);
      } catch {
        setBusy(false);
        return setMsg(t("screenshots.review.badJson"));
      }
    }
    const res = await fetch(`/api/vision/examples/${exampleId}`, remove ? { method: "DELETE" } : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reading: body }) });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMsg(out.error ?? t("screenshots.review.failed"));
    if (remove) router.refresh();
    else setMsg(t("screenshots.example.saved"));
  }

  const toggleExpert = (on: boolean) => {
    if (on) setText(JSON.stringify(data, null, 1));
    else {
      try {
        setData(JSON.parse(text) as Reading);
        setDirty(true);
      } catch {
        return setMsg(t("screenshots.review.badJson"));
      }
    }
    setExpert(on);
  };

  return (
    <div>
      {issues.length > 0 && <ul className="sub" style={{ margin: "6px 0" }}>{issues.map((i, k) => <li key={k} className={i.level === "hard" ? "errtext" : undefined}>{i.message}</li>)}</ul>}
      {exampleId === undefined && <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center", margin: "6px 0" }}>
        {t("screenshots.review.forVillage")}
        <select value={village} onChange={(e) => setVillage(e.target.value)} className="field" style={{ width: "auto", minHeight: 32 }} aria-label={t("screenshots.review.villageAria")}>
          <option value="">{t("screenshots.review.autoDetect")}</option>{villages.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </label>}
      <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center", margin: "6px 0" }}>
        {t("screenshots.review.kind")}
        <select value={data.kind} onChange={(e) => upd({ kind: e.target.value as Reading["kind"] })} className="field" style={{ width: "auto", minHeight: 32 }}>
          {READING_KINDS.map((k) => <option key={k} value={k}>{kindLabels[k] ?? k}</option>)}
        </select>
      </label>

      {!expert && (
        <>
          {(data.kind === "VILLAGE_VIEW" || data.buildings.length > 0) && (
            <div style={{ margin: "8px 0" }}>
              <b>{t("screenshots.review.buildings")}</b>
              <BuildingsTable rows={data.buildings} onChange={(buildings) => upd({ buildings: buildings.map((b) => ({ slot: b.slot, name: b.name ?? null, level: b.level })) })} names={buildingNames} slots={Array.from({ length: 22 }, (_, i) => 19 + i)} />
            </div>
          )}
          {(data.kind === "RESOURCE_VIEW" || data.fields.length > 0) && (
            <div style={{ margin: "8px 0" }}>
              <b>{t("screenshots.review.fields")}</b>
              <BuildingsTable rows={data.fields} onChange={(fields) => upd({ fields: fields.map((f) => ({ slot: f.slot, level: f.level })) })} names={[]} withName={false} slots={Array.from({ length: 18 }, (_, i) => i + 1)} />
            </div>
          )}
          {data.rows.length > 0 && (
            <div style={{ margin: "8px 0" }}>
              <b>{t("screenshots.review.rows")}</b>
              <div className="scroll">
                <table style={{ minWidth: 520 }}>
                  <thead><tr><th>{t("screenshots.review.rowName")}</th><th style={{ width: 110 }}>{t("screenshots.review.rowCoord")}</th><th>{t("screenshots.review.rowCells")}</th></tr></thead>
                  <tbody>{data.rows.map((r, i) => (
                    <tr key={i}>
                      <td><input className="field" style={{ minHeight: 34 }} aria-label={t("screenshots.review.rowName")} value={r.name ?? ""} onChange={(e) => upd({ rows: data.rows.map((x, k) => (k === i ? { ...x, name: e.target.value || null } : x)) })} /></td>
                      <td><input className="field mono" style={{ minHeight: 34 }} aria-label={t("screenshots.review.rowCoord")} defaultValue={r.x !== null && r.y !== null ? `${r.x}|${r.y}` : ""} onBlur={(e) => { const m = /^\s*\(?\s*(-?\d+)\s*[|,;]\s*(-?\d+)\s*\)?\s*$/.exec(e.target.value); upd({ rows: data.rows.map((x, k) => (k === i ? { ...x, x: m ? Number(m[1]) : null, y: m ? Number(m[2]) : null } : x)) }); }} /></td>
                      <td><input className="field mono" style={{ minHeight: 34 }} aria-label={t("screenshots.review.rowCells")} defaultValue={cellsToText(r.cells)} onBlur={(e) => upd({ rows: data.rows.map((x, k) => (k === i ? { ...x, cells: textToCells(e.target.value) } : x)) })} /></td>
                    </tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
        <input type="checkbox" checked={expert} onChange={(e) => toggleExpert(e.target.checked)} /> {t("screenshots.review.expert")}
      </label>
      {expert && <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} aria-label={t("screenshots.review.valuesAria")} style={{ width: "100%", fontFamily: "monospace", fontSize: 12, marginTop: 6 }} />}
      {exampleId === undefined ? (
        <>
          <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
            <input type="checkbox" checked={asExample} onChange={(e) => setAsExample(e.target.checked)} /> {t("screenshots.review.asExample")}
          </label>
          <p className="sub" style={{ fontSize: 12, margin: "2px 0 0 22px" }}>{t("screenshots.review.asExampleHint")}</p>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" disabled={busy} onClick={() => void send("confirm")}>{dirty || expert ? t("screenshots.review.confirmEdited") : t("screenshots.review.confirm")}</button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void send("reject")}>{t("screenshots.review.reject")}</button>
          </div>
        </>
      ) : (
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button type="button" disabled={busy} onClick={() => void saveExample(false)}>{t("screenshots.example.save")}</button>
          <button type="button" className="ghost" disabled={busy} onClick={() => confirm(t("screenshots.example.confirmRemove")) && void saveExample(true)}>{t("screenshots.example.remove")}</button>
        </div>
      )}
      {msg && <p className="errtext" role="status">{msg}</p>}
    </div>
  );
}
