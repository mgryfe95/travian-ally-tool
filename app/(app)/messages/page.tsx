import { Md } from "@/components/Md";
import Link from "next/link";
import { DmComposer, MessengerLive } from "@/components/MessengerLive";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { listInbox, listSent, listThreads, markBroadcastRead, readThread } from "@/lib/services/messenger";
import { requirePermission } from "@/lib/session";
import { openThreadAction, sendBroadcastAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ t?: string; c?: string; b?: string; error?: string; sent?: string }> }) {
  const { t, locale } = await getT();
  const fmt = (d: Date) => fmtDate(d, locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const user = await requirePermission("messenger.use");
  const sp = await searchParams;
  const canBroadcast = hasPermission(user.role, "messenger.broadcast", await loadMatrix(db));
  const tab = sp.t === "bc" ? "bc" : "dm";
  const people = await db.user.findMany({ where: { banned: false, role: { not: "GUEST" }, id: { not: user.id } }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  let body: React.ReactNode = null;
  if (tab === "dm") {
    const [threads, current] = await Promise.all([listThreads(db, user.id), sp.c && Number.isInteger(Number(sp.c)) ? readThread(db, user.id, Number(sp.c)).catch(() => null) : null]);
    body = (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) minmax(0, 1fr)", gap: 16 }} className="msg-grid">
        <section className="card flush" aria-label={t("messenger.conversations")}>
          <form action={openThreadAction} className="row" style={{ padding: 10, gap: 6, flexWrap: "nowrap" }}>
            <label className="sr" htmlFor="newdm">{t("messenger.newTo")}</label>
            <select id="newdm" name="userId" className="field" required style={{ minHeight: 36 }}><option value="">{t("messenger.newToOpt")}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <button className="btn sm">{t("messenger.go")}</button>
          </form>
          {threads.length === 0 && <p className="sub" style={{ padding: "0 12px 12px" }}>{t("messenger.noThreads")}</p>}
          {threads.map((th) => (
            <Link key={th.id} href={`/messages?c=${th.id}`} className="nav" style={{ display: "block", padding: "10px 12px", borderTop: "1px solid var(--line2)", background: String(th.id) === sp.c ? "#2a241a" : undefined }}>
              <div className="row between" style={{ gap: 8 }}><b style={{ fontWeight: th.unread ? 700 : 500 }}>{th.other.name}</b>{th.unread > 0 && <span className="badge">{th.unread}</span>}</div>
              <div className="sub" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{th.last?.mine ? t("messenger.you") : ""}{th.last?.body}</div>
            </Link>
          ))}
        </section>
        <section className="card" style={{ display: "flex", flexDirection: "column", minHeight: 360 }} aria-label={t("messenger.conversation")}>
          {current ? (
            <>
              <h2 style={{ marginBottom: 10 }}>{current.other.name}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "auto", maxHeight: "55vh", marginBottom: 12 }} aria-live="polite">
                {current.messages.length === 0 && <p className="sub">{t("messenger.noMessages")}</p>}
                {current.messages.map((m) => (
                  <div key={m.id} className={`dm-bubble ${m.authorId === user.id ? "mine" : ""}`}>{m.body && <Md text={m.body} />}
                    {m.attachments.length > 0 && (
                      <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap", whiteSpace: "normal" }}>
                        {m.attachments.map((a) => a.removed ? <span key={a.id} className="sub" style={{ fontSize: 12, fontStyle: "italic" }}>{t("chat.msg.removed", { name: a.name })}</span>
                          : a.kind === "image" && a.hasThumb
                            // eslint-disable-next-line @next/next/no-img-element -- geschützter Endpoint
                            ? <a key={a.id} href={`/api/attachments/${a.id}?v=web`} target="_blank" rel="noopener noreferrer"><img src={`/api/attachments/${a.id}?v=thumb`} alt={a.name} style={{ maxWidth: 180, maxHeight: 140, borderRadius: 8, display: "block" }} /></a>
                            : <a key={a.id} href={`/api/attachments/${a.id}?v=dl`} className="pill p-none" style={{ fontSize: 12 }}>📎 {a.name}</a>)}
                      </div>
                    )}
                    <div className="sub" style={{ fontSize: 11, marginTop: 4 }}>{fmt(m.createdAt)}</div></div>
                ))}
              </div>
              <DmComposer threadId={Number(sp.c)} canUpload={hasPermission(user.role, "chat.upload", await loadMatrix(db))} />
            </>
          ) : <p className="sub">{t("messenger.pickThread")}</p>}
        </section>
      </div>
    );
  } else {
    const [inbox, sent] = await Promise.all([listInbox(db, user.id), canBroadcast ? listSent(db, user.id) : []]);
    const open = sp.b ? inbox.find((i) => i.id === Number(sp.b)) : undefined;
    if (open && !open.read) await markBroadcastRead(db, user.id, open.id);
    const tfs = canBroadcast ? await db.taskforce.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
    body = (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 340px) minmax(0, 1fr)", gap: 16 }} className="msg-grid">
          <section className="card flush" aria-label={t("messenger.inbox")}>
            {inbox.length === 0 && <p className="sub" style={{ padding: 12 }}>{t("messenger.noBroadcasts")}</p>}
            {inbox.map((i) => (
              <Link key={i.id} href={`/messages?t=bc&b=${i.id}`} className="nav" style={{ display: "block", padding: "10px 12px", borderTop: "1px solid var(--line2)", background: i.id === open?.id ? "#2a241a" : undefined }}>
                <div className="row between"><b style={{ fontWeight: i.read ? 500 : 700 }}>{i.subject}</b>{!i.read && <span className="badge">{t("messenger.new")}</span>}</div>
                <div className="sub" style={{ fontSize: 12 }}>{i.sender.name} · {fmt(i.createdAt)}</div>
              </Link>
            ))}
          </section>
          <section className="card" aria-label={t("messenger.broadcast")}>
            {open ? (
              <>
                <h2>{open.subject}</h2>
                <div className="sub" style={{ margin: "2px 0 10px" }}>{t("messenger.from", { name: open.sender.name })} · {fmt(open.createdAt)}</div>
                <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><Md text={open.body} /></div>
                <form action={openThreadAction} style={{ marginTop: 14 }}>
                  <input type="hidden" name="userId" value={open.sender.id} />
                  <button className="btn ghost sm">{t("messenger.reply", { name: open.sender.name })}</button>
                </form>
              </>
            ) : <p className="sub">{t("messenger.pickBroadcast")}</p>}
          </section>
        </div>
        {canBroadcast && (
          <>
            <section className="card" aria-labelledby="bcnew" style={{ marginTop: 16 }}>
              <h2 id="bcnew">{t("messenger.newBroadcast")}</h2>
              <form action={sendBroadcastAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <div><label className="lbl" htmlFor="aud">{t("messenger.to")}</label>
                    <select id="aud" name="audience" className="field" style={{ width: "auto" }} defaultValue="all">
                      <option value="all">{t("messenger.aud.all")}</option><option value="role:MODERATOR">{t("messenger.aud.mods")}</option><option value="role:ADMIN">{t("messenger.aud.admins")}</option>
                      {tfs.map((tf) => <option key={tf.id} value={`tf:${tf.id}`}>{t("messenger.aud.taskforce", { name: tf.name })}</option>)}<option value="users">{t("messenger.aud.users")}</option>
                    </select></div>
                  <div style={{ flex: "1 1 240px" }}><label className="lbl" htmlFor="subj">{t("messenger.subject")}</label><input id="subj" name="subject" className="field" required minLength={2} maxLength={100} /></div>
                </div>
                <textarea name="body" className="field" rows={4} required maxLength={4000} aria-label={t("messenger.bodyLabel")} style={{ width: "100%" }} />
                <details><summary className="sub" style={{ cursor: "pointer" }}>{t("messenger.pickMembers")}</summary>
                  <div style={{ maxHeight: 180, overflow: "auto", display: "grid", gap: 4, marginTop: 6 }}>
                    {people.map((p) => <label key={p.id} className="row" style={{ gap: 8 }}><input type="checkbox" name="userIds" value={p.id} />{p.name}</label>)}
                  </div></details>
                <div className="row"><button className="btn">{t("messenger.sendBroadcast")}</button></div>
              </form>
            </section>
            {sent.length > 0 && (
              <section className="card flush" style={{ marginTop: 16 }} aria-labelledby="sentl">
                <h2 id="sentl" style={{ margin: "12px 12px 8px" }}>{t("messenger.sentTitle")}</h2>
                <div className="scroll"><table><thead><tr><th>{t("messenger.col.date")}</th><th>{t("messenger.col.subject")}</th><th>{t("messenger.col.to")}</th><th className="r">{t("messenger.col.read")}</th></tr></thead>
                  <tbody>{sent.map((s) => <tr key={s.id}><td>{fmt(s.createdAt)}</td><td>{s.subject}</td><td>{s.audience}</td><td className="mono r">{s.read}/{s.recipients}</td></tr>)}</tbody></table></div>
              </section>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <MessengerLive />
      <header>
        <div className="sub">{t("messenger.eyebrow")}</div>
        <h1>{t("messenger.title")}</h1>
        <p className="sub" style={{ fontSize: 12, marginTop: 4 }}>{t("privacy.short.msg")} <a href="/privacy">{t("privacy.more")}</a></p>
        <div className="row" role="tablist" style={{ gap: 8, marginTop: 10 }}>
          <Link role="tab" aria-selected={tab === "dm"} className={`filterchip ${tab === "dm" ? "on" : ""}`} href="/messages">{t("messenger.tab.direct")}</Link>
          <Link role="tab" aria-selected={tab === "bc"} className={`filterchip ${tab === "bc" ? "on" : ""}`} href="/messages?t=bc">{t("messenger.tab.broadcasts")}</Link>
        </div>
      </header>
      {sp.error && <p className="errtext" role="alert">{sp.error}</p>}
      {sp.sent && <p className="sub" role="status">{t(Number(sp.sent) === 1 ? "messenger.sentOne" : "messenger.sentOther", { n: sp.sent })}</p>}
      {body}
    </>
  );
}
