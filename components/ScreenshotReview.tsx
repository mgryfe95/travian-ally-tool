"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Lernmodus: erkannte Werte prüfen, bei Bedarf als JSON korrigieren, bestätigen → fließt in den Dorfzustand und in die Beispiele. */
export function ScreenshotReview({ id, reading, issues, villages, defaultVillageId }: { id: number; reading: unknown; issues: { level: string; message: string }[]; villages: { id: number; label: string }[]; defaultVillageId?: number }) {
  const router = useRouter();
  const [text, setText] = useState(() => JSON.stringify(reading, null, 1));
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [village, setVillage] = useState(defaultVillageId ? String(defaultVillageId) : "");

  async function send(action: "confirm" | "reject") {
    setBusy(true);
    setMsg(undefined);
    let parsed: unknown;
    if (action === "confirm" && edit) {
      try {
        parsed = JSON.parse(text);
      } catch {
        setBusy(false);
        return setMsg("Kein gültiges JSON");
      }
    }
    const res = await fetch(`/api/screenshots/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reading: parsed, villageId: village ? Number(village) : undefined }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string | null };
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? data.message ?? "Fehlgeschlagen");
    router.refresh();
  }

  return (
    <div>
      {issues.length > 0 && <ul className="sub" style={{ margin: "6px 0" }}>{issues.map((i, k) => <li key={k} className={i.level === "hard" ? "errtext" : undefined}>{i.message}</li>)}</ul>}
      <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center", margin: "6px 0" }}>
        Für Dorf
        <select value={village} onChange={(e) => setVillage(e.target.value)} className="field" style={{ width: "auto", minHeight: 32 }} aria-label="Dorf für diese Lesung">
          <option value="">automatisch erkennen</option>{villages.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </label>
      <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={edit} onChange={(e) => setEdit(e.target.checked)} /> Werte korrigieren (JSON)
      </label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} readOnly={!edit} rows={edit ? 16 : 6} aria-label="Erkannte Werte" style={{ width: "100%", fontFamily: "monospace", fontSize: 12, marginTop: 6 }} />
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button type="button" disabled={busy} onClick={() => void send("confirm")}>{edit ? "Korrigiert bestätigen" : "Stimmt, übernehmen"}</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void send("reject")}>Verwerfen</button>
      </div>
      {msg && <p className="errtext" role="status">{msg}</p>}
    </div>
  );
}
