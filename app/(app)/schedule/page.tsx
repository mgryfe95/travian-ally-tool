import { CoordLink } from "@/components/CoordLink";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { CALL_KINDS, PLACEHOLDERS, renderCall } from "@/lib/services/schedule";
import { requirePermission } from "@/lib/session";
import { cancelCallAction, createCallAction, deleteCallAction, deleteTemplateAction, saveTemplateAction, sendCallAction } from "../admin/actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, MessageKey> = { scheduled: "schedule.status.scheduled", draft: "schedule.status.draft", sent: "schedule.status.sent", cancelled: "schedule.status.cancelled", sending: "schedule.status.sending" };
const KIND: Record<(typeof CALL_KINDS)[number], MessageKey> = { ATTACK: "schedule.kind.ATTACK", DEFF: "schedule.kind.DEFF", ATTACK_DAY: "schedule.kind.ATTACK_DAY", OTHER: "schedule.kind.OTHER" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { t, locale } = await getT();
  const when = (d: Date | null) => (d ? fmtDate(d, locale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");
  const kindLabel = (k: string) => (k in KIND ? t(KIND[k as keyof typeof KIND]) : k);
  const statusLabel = (s: string) => (STATUS[s] ? t(STATUS[s]) : s);
  const user = await requirePermission("schedule.view");
  const { error } = await searchParams;
  const manage = hasPermission(user.role, "schedule.manage", await loadMatrix(db));
  const [calls, templates, channels] = await Promise.all([
    db.allianceCall.findMany({ orderBy: [{ at: "asc" }, { id: "desc" }], take: 80 }),
    db.callTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    db.channel.findMany({ where: { tree: "ALLY", archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  const open = calls.filter((c) => c.status === "scheduled" || c.status === "draft");
  const done = calls.filter((c) => c.status === "sent" || c.status === "cancelled").reverse().slice(0, 20);
  const chName = new Map(channels.map((c) => [c.id, c.name]));
  return (
    <>
      <header>
        <div className="sub">{t("schedule.eyebrow")}</div>
        <h1>{t("schedule.title")}</h1>
        <p className="sub" style={{ marginTop: 4 }}>{t("schedule.intro")}</p>
      </header>
      {error && <p className="errtext" role="alert">{error}</p>}

      {manage && (
        <section className="card" aria-labelledby="new">
          <h2 id="new">{t("schedule.new.title")}</h2>
          <form action={createCallAction} className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
            <div><label className="lbl" htmlFor="kind">{t("schedule.new.kind")}</label>
              <select id="kind" name="kind" className="field" style={{ width: "auto" }}>{CALL_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select></div>
            <div><label className="lbl" htmlFor="coord">{t("schedule.new.coords")}</label>
              <input id="coord" name="coord" className="field" placeholder="-3|-82" style={{ width: 120 }} /></div>
            <div><label className="lbl" htmlFor="at">{t("schedule.new.time")}</label>
              <input id="at" name="at" type="datetime-local" className="field" style={{ width: "auto" }} /></div>
            <div><label className="lbl" htmlFor="chn">{t("schedule.new.channel")}</label>
              <select id="chn" name="channelId" className="field" style={{ width: "auto" }}><option value="">{t("schedule.new.byTemplate")}</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div style={{ flex: "1 1 180px" }}><label className="lbl" htmlFor="title">{t("schedule.new.titleOpt")}</label>
              <input id="title" name="title" className="field" maxLength={80} /></div>
            <div style={{ flex: "1 1 220px" }}><label className="lbl" htmlFor="note">{t("schedule.new.note")}</label>
              <input id="note" name="note" className="field" maxLength={500} /></div>
            <button className="btn">{t("schedule.new.create")}</button>
            <button className="btn ghost" name="sendNow" value="1">{t("schedule.new.createSend")}</button>
          </form>
          <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>{t("schedule.new.hint")}</p>
        </section>
      )}

      <section className="card flush" aria-labelledby="open">
        <h2 id="open" style={{ margin: "12px 12px 8px" }}>{t("schedule.upcoming", { n: open.length })}</h2>
        {open.length === 0 ? <p className="sub" style={{ margin: "0 12px 12px" }}>{t("schedule.noUpcoming")}</p> : (
          <div className="scroll"><table style={{ minWidth: 760 }}>
            <thead><tr><th>{t("schedule.col.time")}</th><th>{t("schedule.col.kind")}</th><th>{t("schedule.col.target")}</th><th>{t("schedule.col.channel")}</th><th>{t("schedule.col.status")}</th><th>{t("schedule.col.preview")}</th><th /></tr></thead>
            <tbody>{open.map((c) => (
              <tr key={c.id}>
                <td>{when(c.at)}</td><td>{kindLabel(c.kind)}</td>
                <td>{c.playerName ? <>{c.playerName} <span className="mono sub"><CoordLink x={c.x!} y={c.y!} className="mono sub" /></span></> : c.title || "–"}</td>
                <td>{chName.get(c.channelId) ?? "?"}</td><td><span className="pill p-wait">{statusLabel(c.status)}</span></td>
                <td className="sub" style={{ maxWidth: 280, whiteSpace: "pre-wrap", fontSize: 12 }}>{renderCall(c)}</td>
                <td className="r">{manage && (
                  <span className="row" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
                    <form action={sendCallAction}><input type="hidden" name="callId" value={c.id} /><button className="btn sm">{t("schedule.sendNow")}</button></form>
                    <form action={cancelCallAction}><input type="hidden" name="callId" value={c.id} /><button className="btn ghost sm">{t("schedule.cancel")}</button></form>
                  </span>)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      {done.length > 0 && (
        <section className="card flush" aria-labelledby="done">
          <h2 id="done" style={{ margin: "12px 12px 8px" }}>{t("schedule.recent")}</h2>
          <div className="scroll"><table style={{ minWidth: 560 }}>
            <tbody>{done.map((c) => (
              <tr key={c.id}><td>{when(c.sentAt ?? c.at)}</td><td>{kindLabel(c.kind)}</td><td>{c.playerName ?? c.title ?? "–"}</td><td>{chName.get(c.channelId) ?? "?"}</td><td>{statusLabel(c.status)}</td>
                <td className="r">{manage && <form action={deleteCallAction}><input type="hidden" name="callId" value={c.id} /><button className="btn ghost sm">{t("schedule.delete")}</button></form>}</td></tr>))}</tbody>
          </table></div>
        </section>
      )}

      {manage && (
        <section className="card" aria-labelledby="tpl">
          <h2 id="tpl">{t("schedule.tpl.title")}</h2>
          <p className="sub" style={{ fontSize: 12, margin: "4px 0 10px" }}>{t("schedule.tpl.placeholders", { placeholders: PLACEHOLDERS.join(" ") })}</p>
          {templates.map((tpl) => (
            <form key={tpl.id} action={saveTemplateAction} style={{ borderTop: "1px solid var(--line2)", padding: "10px 0" }}>
              <input type="hidden" name="templateId" value={tpl.id} />
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                <input name="name" defaultValue={tpl.name} className="field" aria-label={t("schedule.tpl.name")} style={{ minHeight: 36, flex: "1 1 160px" }} />
                <select name="kind" defaultValue={tpl.kind} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("schedule.tpl.kind")}>{CALL_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select>
                <select name="channelId" defaultValue={tpl.channelId ?? ""} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("schedule.tpl.defaultChannel")}><option value="">{t("schedule.tpl.firstChannel")}</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <textarea name="body" defaultValue={tpl.body} rows={4} className="field" aria-label={t("schedule.tpl.body")} style={{ width: "100%", marginTop: 8, fontFamily: "inherit" }} />
              <div className="row" style={{ marginTop: 6 }}><button className="btn ghost sm">{t("schedule.tpl.save")}</button><button formAction={deleteTemplateAction} className="btn ghost sm">{t("schedule.delete")}</button></div>
            </form>
          ))}
          <form action={saveTemplateAction} style={{ borderTop: "1px solid var(--line2)", padding: "10px 0 0" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <input name="name" required minLength={2} className="field" placeholder={t("schedule.tpl.newName")} aria-label={t("schedule.tpl.newName")} style={{ minHeight: 36, flex: "1 1 160px" }} />
              <select name="kind" className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("schedule.tpl.newKind")}>{CALL_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select>
            </div>
            <textarea name="body" required rows={3} className="field" aria-label={t("schedule.tpl.newBody")} placeholder={t("schedule.tpl.newBodyPh")} style={{ width: "100%", marginTop: 8, fontFamily: "inherit" }} />
            <button className="btn ghost sm" style={{ marginTop: 6 }}>{t("schedule.tpl.create")}</button>
          </form>
        </section>
      )}
    </>
  );
}
