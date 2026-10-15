"use client";

import { useState } from "react";
import { Md } from "@/components/Md";
import type { MessageView } from "@/lib/services/chat";

const AV = ["#d9a441", "#8cc4de", "#c99be0", "#9fd39a"];
const ROLE: Record<string, string> = { SYSTEMADMIN: "Admin", ADMIN: "Admin", MODERATOR: "Moderator", MEMBER: "Member", GUEST: "Gast" };
const size = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function MessageItem(props: {
  m: MessageView; showChannel: boolean; canEdit: boolean; canDelete: boolean;
  onEdit: (id: number, body: string) => Promise<string | undefined>; onDelete: (id: number) => void; onOpenImage: (images: { id: number; name: string }[], idx: number) => void;
}) {
  const { m } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [err, setErr] = useState<string>();
  const images = m.attachments.filter((a) => a.kind === "image");
  const time = new Date(m.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const grid = images.length > 1;

  return (
    <article className="msg" style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr)", gap: 12 }}>
      <div className="avatar" aria-hidden="true" style={{ background: AV[m.author.name.charCodeAt(0) % AV.length] }}>{m.author.name[0]?.toUpperCase()}</div>
      <div>
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <b>{m.author.name}</b>
          <span className="sub" style={{ fontSize: 12 }}>{ROLE[m.author.role]}</span>
          <span className="mono sub" style={{ fontSize: 12 }}>{time}{m.editedAt ? " · bearbeitet" : ""}</span>
          {props.showChannel && <span className="chip"># {m.channelName}</span>}
          {m.tags.map((t) => <span key={t.id} className={`pill t-${t.color}`}>{t.name}</span>)}
          <span className="msg-actions">
            {props.canEdit && <button type="button" className="btn ghost sm" style={{ minHeight: 28 }} onClick={() => { setDraft(m.body); setEditing(true); }}>Bearbeiten</button>}
            {props.canDelete && <button type="button" className="btn ghost sm" style={{ minHeight: 28 }} onClick={() => confirm("Nachricht wirklich löschen?") && props.onDelete(m.id)}>Löschen</button>}
          </span>
        </div>
        {editing ? (
          <form className="row" style={{ marginTop: 4 }} onSubmit={async (e) => { e.preventDefault(); const r = await props.onEdit(m.id, draft); if (r) setErr(r); else setEditing(false); }}>
            <label className="sr" htmlFor={`edit-${m.id}`}>Nachricht bearbeiten</label>
            <input id={`edit-${m.id}`} className="field" style={{ flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <button className="btn sm">Speichern</button>
            <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>Abbrechen</button>
            {err && <span className="errtext">{err}</span>}
          </form>
        ) : (
          m.body && <div style={{ marginTop: 2, color: "#e2dccd", overflowWrap: "anywhere" }}><Md text={m.body} /></div>
        )}
        {images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: grid ? "repeat(auto-fill, minmax(150px, 1fr))" : "1fr", gap: 6, marginTop: 8, maxWidth: grid ? 520 : 320 }}>
            {images.map((a, idx) => (
              <button key={a.id} type="button" aria-label={`Bild ${a.name} vergrößern`} onClick={() => props.onOpenImage(images.map((x) => ({ id: x.id, name: x.name })), idx)}
                style={{ padding: 0, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", cursor: "zoom-in", background: "#211d17", textAlign: "left" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- geschützter Endpoint */}
                <img src={`/api/attachments/${a.id}?v=thumb`} alt={a.name} width={a.width ?? undefined} height={a.height ?? undefined} loading="lazy"
                  style={{ display: "block", width: "100%", height: grid ? 120 : "auto", maxHeight: 240, objectFit: grid ? "cover" : "contain" }} />
                {!grid && <div className="sub" style={{ fontSize: 12, padding: "6px 10px" }}>{a.name} · {size(a.sizeBytes)}</div>}
              </button>
            ))}
          </div>
        )}
        {m.attachments.filter((a) => a.kind === "pdf").map((a) => (
          <div key={a.id} className="attach-card">
            {a.hasThumb
              // eslint-disable-next-line @next/next/no-img-element -- geschützter Endpoint
              ? <img src={`/api/attachments/${a.id}?v=thumb`} alt="Seite 1" width={48} height={60} style={{ objectFit: "cover", borderRadius: 4, background: "#ece6d8" }} />
              : <div style={{ width: 48, height: 60, borderRadius: 4, background: "#ece6d8", color: "#333", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>PDF</div>}
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{a.name}</div><div className="sub" style={{ fontSize: 12 }}>PDF · {size(a.sizeBytes)}</div></div>
            <a className="btn ghost sm" href={`/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer">Öffnen</a>
          </div>
        ))}
        {m.attachments.filter((a) => a.kind === "text").map((a) => (
          <details key={a.id} className="attach-card" style={{ display: "block" }}>
            <summary style={{ cursor: "pointer" }}>{a.name} <span className="sub" style={{ fontSize: 12 }}>· {size(a.sizeBytes)}</span></summary>
            <pre className="mono" style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, color: "var(--text2)" }}>{a.snippet}</pre>
            <a href={`/api/attachments/${a.id}?v=dl`} style={{ fontSize: 12 }}>Herunterladen</a>
          </details>
        ))}
      </div>
    </article>
  );
}
