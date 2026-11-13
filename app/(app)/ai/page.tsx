import Link from "next/link";
import { AiChatForm } from "@/components/AiChatForm";
import { Md } from "@/components/Md";
import { getEmbedder } from "@/lib/ai/embed";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { hasPermission } from "@/lib/permissions";
import { canUseChat, chatGate, getChat, listChats } from "@/lib/services/aichat";
import { loadMatrix } from "@/lib/services/context";
import { listMemory } from "@/lib/services/memory";
import { requireUser } from "@/lib/session";
import { deleteChatAction, deleteMemoryAction, finishAction, newChatAction, reembedAction, savePromptAction, sendAction } from "./actions";

export const dynamic = "force-dynamic";

const TABS = [["chats", "aichat.tab.chats"], ["prompt", "aichat.tab.prompt"], ["rag", "aichat.tab.rag"]] as const;
const SOURCES = ["incident", "chat", "recommendation", "knowledge"] as const;

export default async function AiPage({ searchParams }: { searchParams: Promise<{ tab?: string; c?: string; error?: string; saved?: string; embedded?: string; src?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const tab = TABS.some(([id]) => id === sp.tab) ? sp.tab! : "chats";
  const matrix = await loadMatrix(db);
  const canChat = await canUseChat(db, user);
  const canReport = hasPermission(user.role, "incidents.report", matrix);
  const tabs = (
    <div role="tablist" aria-label={t("aichat.title")} className="tabs">
      {TABS.map(([id, label]) => <Link key={id} role="tab" aria-selected={id === tab} className={`tab ${id === tab ? "on" : ""}`} href={`/ai?tab=${id}`}>{t(label)}</Link>)}
    </div>
  );
  const head = (
    <header>
      <div className="sub">{t("aichat.nav")}</div>
      <h1>{t("aichat.title")}</h1>
      <p className="sub">{t("aichat.sub")}</p>
    </header>
  );
  const err = sp.error ? <p className="errtext" role="alert">{sp.error}</p> : null;

  if (tab === "prompt") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { aiChatPrompt: true } });
    return (
      <>{head}{tabs}{err}
        <form action={savePromptAction} className="card" style={{ display: "grid", gap: 10 }}>
          <label className="lbl" htmlFor="ai-p">{t("aichat.tab.prompt")}</label>
          <p className="sub">{t("aichat.prompt.intro")}</p>
          <textarea id="ai-p" name="prompt" rows={8} className="field" maxLength={4000} defaultValue={me?.aiChatPrompt ?? ""} />
          <div className="row" style={{ gap: 10, alignItems: "center" }}><button className="btn">{t("aichat.prompt.save")}</button>{sp.saved && <span className="sub" role="status">{t("aichat.prompt.saved")}</span>}</div>
        </form>
      </>
    );
  }

  if (tab === "rag") {
    const src = SOURCES.find((s) => s === sp.src);
    const rows = await listMemory(db, user.id, { sourceType: src });
    const embedder = getEmbedder();
    return (
      <>{head}{tabs}{err}
        <section className="card" aria-labelledby="rag-h">
          <h2 id="rag-h">{t("aichat.tab.rag")}</h2>
          <p className="sub" style={{ margin: "4px 0 8px" }}>{t("aichat.rag.intro")}</p>
          <p className={embedder ? "sub" : "card warn"} role="status">{embedder ? t("aichat.rag.vector", { model: env().EMBED_MODEL }) : t("aichat.rag.fulltext")}</p>
          {sp.embedded && <p className="sub" role="status">{t("aichat.rag.done", { n: Number(sp.embedded) || 0 })}</p>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <Link className={`btn ghost sm ${!src ? "on" : ""}`} href="/ai?tab=rag">{t("aichat.rag.all")}</Link>
            {SOURCES.map((s) => <Link key={s} className="btn ghost sm" aria-current={s === src ? "page" : undefined} href={`/ai?tab=rag&src=${s}`}>{t(`aichat.rag.src.${s}` as MessageKey)}</Link>)}
            {embedder && <form action={reembedAction}><button className="btn sm">{t("aichat.rag.reembedAll")}</button></form>}
          </div>
        </section>
        <section className="card flush">
          {rows.length === 0 ? <p className="sub" style={{ margin: 12 }}>{t("aichat.rag.none")}</p> : (
            <div className="scroll"><table>
              <thead><tr><th>{t("aichat.rag.col.source")}</th><th>{t("aichat.rag.col.entry")}</th><th>{t("aichat.rag.col.embedding")}</th><th>{t("aichat.rag.col.updated")}</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td>{t(`aichat.rag.src.${r.sourceType}` as MessageKey)}{r.scope === "global" ? <span className="sub"> · {t("aichat.rag.global")}</span> : null}</td>
                  <td style={{ maxWidth: 520 }}>
                    {r.sourceType === "incident" && r.sourceId ? <Link href={`/incidents/${r.sourceId}`}><b>{r.title}</b></Link> : r.sourceType === "chat" && r.sourceId ? <Link href={`/ai?c=${r.sourceId}`}><b>{r.title}</b></Link> : <b>{r.title}</b>}
                    <div className="sub" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{r.body.length > 300 ? `${r.body.slice(0, 300)}…` : r.body}</div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.embeddedAt ? `✓ ${r.embedModel} · ${r.dims}d` : t("aichat.rag.notEmbedded")}</td>
                  <td>{fmtDate(r.updatedAt, locale, { dateStyle: "short" })}</td>
                  <td>{r.scope === "user" && (
                    <div className="row" style={{ gap: 6 }}>
                      {embedder && <form action={reembedAction}><input type="hidden" name="id" value={r.id} /><button className="btn ghost sm">{t("aichat.rag.reembed")}</button></form>}
                      <form action={deleteMemoryAction}><input type="hidden" name="id" value={r.id} /><button className="btn ghost sm">{t("aichat.rag.delete")}</button></form>
                    </div>
                  )}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      </>
    );
  }

  const chats = await listChats(db, user.id);
  const cid = Number(sp.c);
  const chat = Number.isInteger(cid) ? await getChat(db, user.id, cid) : null;
  const gate = canChat ? await chatGate(db, user.id) : null;
  const incident = chat?.kind === "incident" && chat.incidentId ? await db.incident.findUnique({ where: { id: chat.incidentId }, select: { id: true, status: true } }) : null;
  return (
    <>{head}{tabs}{err}
      {!canChat && <p className="card soft">{t("aichat.noPerm")}</p>}
      {canChat && gate && <p className="card warn">{t(`err.aichat.gate.${gate}` as MessageKey)} {gate === "noKey" ? t("aichat.noAi") : ""}</p>}
      <div className="row" style={{ gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <nav className="card" aria-label={t("aichat.tab.chats")} style={{ flex: "1 1 220px", maxWidth: 300 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {canChat && <form action={newChatAction}><button className="btn sm">{t("aichat.new")}</button></form>}
            {canReport && <Link className="btn ghost sm" href="/incidents/new">{t("incidents.new.title")}</Link>}
          </div>
          {chats.length === 0 ? <p className="sub">{t("aichat.empty")}</p> : chats.map((c) => (
            <Link key={c.id} className={`listbtn ${c.id === chat?.id ? "on" : ""}`} href={`/ai?c=${c.id}`} aria-current={c.id === chat?.id ? "page" : undefined} style={{ flexDirection: "column", alignItems: "flex-start", padding: "6px 10px" }}>
              <span>{c.title || "…"}</span>
              <span style={{ fontSize: 11 }}>
                {c.kind === "incident" && <span className="pill p-wait">{t("aichat.badge.incident")}{c.incidentStatus && c.incidentStatus !== "clarifying" ? ` · ${t("aichat.badge.done")}` : ""}</span>} {fmtDate(c.updatedAt, locale, { dateStyle: "short", timeStyle: "short" })}
              </span>
            </Link>
          ))}
        </nav>
        <section className="card" style={{ flex: "3 1 420px", minWidth: 0 }} aria-label={chat?.title || t("aichat.title")}>
          {!chat ? <p className="sub">{t("aichat.pick")}</p> : (
            <>
              <div className="row" style={{ gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>{chat.title || "…"} {chat.kind === "incident" && <span className="pill p-wait" style={{ fontSize: 12 }}>{t("aichat.badge.incident")}</span>}</h2>
                <div className="row" style={{ gap: 6 }}>
                  {incident && <Link className="btn ghost sm" href={`/incidents/${incident.id}`}>{t("aichat.openIncident")}</Link>}
                  {incident?.status === "clarifying" && <form action={finishAction}><input type="hidden" name="chatId" value={chat.id} /><button className="btn sm">{t("aichat.finish")}</button></form>}
                  {chat.kind === "chat" && <form action={deleteChatAction}><input type="hidden" name="chatId" value={chat.id} /><button className="btn ghost sm">{t("aichat.delete")}</button></form>}
                </div>
              </div>
              <ol style={{ listStyle: "none", padding: 0, margin: "12px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                {chat.messages.map((m) => (
                  <li key={m.id} className={m.role === "user" ? "" : "card soft"} style={{ padding: m.role === "user" ? "0 4px" : 10, margin: 0 }}>
                    <div className="sub" style={{ fontSize: 12, fontWeight: 700 }}>{m.role === "user" ? t("aichat.you") : t("aichat.ai")} · {fmtDate(m.createdAt, locale, { timeStyle: "short" })}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}><Md text={m.content} /></div>
                  </li>
                ))}
              </ol>
              <div id="end" />
              {(chat.kind === "incident" || canChat) && <AiChatForm action={sendAction} chatId={chat.id} incident={chat.kind === "incident"} />}
              {chat.kind === "chat" && <p className="sub" style={{ fontSize: 12, marginTop: 6 }}>{t("aichat.cmd.help")}</p>}
            </>
          )}
        </section>
      </div>
    </>
  );
}
