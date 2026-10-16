"use client";

import { useState } from "react";
import { Md } from "@/components/Md";
import { fmtDate } from "@/lib/format";
import { INTL_TAG, type Locale } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import type { MessageView } from "@/lib/services/chat";
import { USER_ROLE_KEY } from "./roles";

const AV = ["#1e3556", "#5e7f3a", "#8a6414", "#6b3f63"];
/** Tags nach Tag-Typ gruppieren (Reihenfolge der ersten Vorkommen bleibt erhalten). */
const groupTags = (tags: MessageView["tags"]) => {
  const g = new Map<number, { typeId: number; typeName: string; tags: MessageView["tags"] }>();
  for (const t of tags) (g.get(t.typeId) ?? g.set(t.typeId, { typeId: t.typeId, typeName: t.typeName, tags: [] }).get(t.typeId)!).tags.push(t);
  return [...g.values()];
};
const size = (b: number, locale: Locale) => (b > 1_048_576 ? `${(b / 1_048_576).toLocaleString(INTL_TAG[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function MessageItem(props: {
  m: MessageView; showChannel: boolean; focused?: boolean; onReply?: (m: MessageView) => void; canEdit: boolean; canDelete: boolean;
  onEdit: (id: number, body: string) => Promise<string | undefined>; onDelete: (id: number) => void; onOpenImage: (images: { id: number; name: string }[], idx: number) => void;
}) {
  const { m } = props;
  const t = useT();
  const locale = useLocale();
  const roleKey = USER_ROLE_KEY[m.author.role];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [err, setErr] = useState<string>();
  const live = m.attachments.filter((a) => !a.removed);
  const gone = m.attachments.filter((a) => a.removed);
  const images = live.filter((a) => a.kind === "image");
  const time = fmtDate(new Date(m.createdAt), locale, { hour: "2-digit", minute: "2-digit" });
  const grid = images.length > 1;

  return (
    <article id={`msg-${m.id}`} className={`msg${m.replyTo ? " reply" : ""}${props.focused ? " focus" : ""}`} style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr)", gap: 12 }}>
      <div className="avatar" aria-hidden="true" style={{ background: AV[m.author.name.charCodeAt(0) % AV.length] }}>{m.author.name[0]?.toUpperCase()}</div>
      <div>
        {m.replyTo && (
          <button type="button" className="replyref" onClick={() => document.getElementById(`msg-${m.replyTo!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            {t("chat.reply.ref", { name: m.replyTo.authorName, text: m.replyTo.excerpt })}
          </button>
        )}
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <b>{m.author.name}</b>
          <span className="sub" style={{ fontSize: 12 }}>{roleKey ? t(roleKey) : m.author.role}</span>
          <span className="mono sub" style={{ fontSize: 12 }}>{time}{m.editedAt ? t("chat.msg.edited") : ""}</span>
          {props.showChannel && <span className="chip"># {m.channelName}</span>}
          {groupTags(m.tags).map((g) => (
            <span key={g.typeId} className="row" style={{ gap: 4, alignItems: "baseline" }}>
              <span className="sub" style={{ fontSize: 11 }}>{g.typeName}:</span>
              {g.tags.map((tag) => <span key={tag.id} className={`pill t-${tag.color}`}>{tag.name}</span>)}
            </span>
          ))}
          <span className="msg-actions">
            {props.onReply && <button type="button" className="btn ghost sm" style={{ minHeight: 28 }} onClick={() => props.onReply!(m)}>{t("chat.msg.reply")}</button>}
            {props.canEdit && <button type="button" className="btn ghost sm" style={{ minHeight: 28 }} onClick={() => { setDraft(m.body); setEditing(true); }}>{t("chat.msg.edit")}</button>}
            {props.canDelete && <button type="button" className="btn ghost sm" style={{ minHeight: 28 }} onClick={() => confirm(t("chat.msg.confirmDelete")) && props.onDelete(m.id)}>{t("chat.msg.delete")}</button>}
          </span>
        </div>
        {editing ? (
          <form className="row" style={{ marginTop: 4 }} onSubmit={async (e) => { e.preventDefault(); const r = await props.onEdit(m.id, draft); if (r) setErr(r); else setEditing(false); }}>
            <label className="sr" htmlFor={`edit-${m.id}`}>{t("chat.msg.editLabel")}</label>
            <input id={`edit-${m.id}`} className="field" style={{ flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <button className="btn sm">{t("chat.msg.save")}</button>
            <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>{t("chat.cancel")}</button>
            {err && <span className="errtext">{err}</span>}
          </form>
        ) : (
          m.body && <div style={{ marginTop: 2, color: "var(--text)", overflowWrap: "anywhere" }}><Md text={m.body} /></div>
        )}
        {images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: grid ? "repeat(auto-fill, minmax(150px, 1fr))" : "1fr", gap: 6, marginTop: 8, maxWidth: grid ? 520 : 320 }}>
            {images.map((a, idx) => (
              <button key={a.id} type="button" aria-label={t("chat.msg.enlarge", { name: a.name })} onClick={() => props.onOpenImage(images.map((x) => ({ id: x.id, name: x.name })), idx)}
                style={{ padding: 0, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", cursor: "zoom-in", background: "var(--soft)", textAlign: "left" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- geschützter Endpoint */}
                <img src={`/api/attachments/${a.id}?v=thumb`} alt={a.name} width={a.width ?? undefined} height={a.height ?? undefined} loading="lazy"
                  style={{ display: "block", width: "100%", height: grid ? 120 : "auto", maxHeight: 240, objectFit: grid ? "cover" : "contain" }} />
                {!grid && <div className="sub" style={{ fontSize: 12, padding: "6px 10px" }}>{a.name} · {size(a.sizeBytes, locale)}</div>}
              </button>
            ))}
          </div>
        )}
        {live.filter((a) => a.kind === "pdf").map((a) => (
          <div key={a.id} className="attach-card">
            {a.hasThumb
              // eslint-disable-next-line @next/next/no-img-element -- geschützter Endpoint
              ? <img src={`/api/attachments/${a.id}?v=thumb`} alt={t("chat.msg.page1")} width={48} height={60} style={{ objectFit: "cover", borderRadius: 4, background: "#ece6d8" }} />
              : <div style={{ width: 48, height: 60, borderRadius: 4, background: "#ece6d8", color: "#333", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>PDF</div>}
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{a.name}</div><div className="sub" style={{ fontSize: 12 }}>PDF · {size(a.sizeBytes, locale)}</div></div>
            <a className="btn ghost sm" href={`/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer">{t("chat.msg.open")}</a>
          </div>
        ))}
        {gone.map((a) => <div key={a.id} className="attach-card sub" style={{ fontStyle: "italic" }}>{t("chat.msg.removed", { name: a.name })}</div>)}
        {live.filter((a) => a.kind === "text").map((a) => (
          <details key={a.id} className="attach-card" style={{ display: "block" }}>
            <summary style={{ cursor: "pointer" }}>{a.name} <span className="sub" style={{ fontSize: 12 }}>· {size(a.sizeBytes, locale)}</span></summary>
            <pre className="mono" style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, color: "var(--text2)" }}>{a.snippet}</pre>
            <a href={`/api/attachments/${a.id}?v=dl`} style={{ fontSize: 12 }}>{t("chat.msg.download")}</a>
          </details>
        ))}
      </div>
    </article>
  );
}
