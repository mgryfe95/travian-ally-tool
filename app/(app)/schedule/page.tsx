import { CoordInput } from "@/components/CoordInput";
import { CoordLink } from "@/components/CoordLink";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { CALL_KINDS, PLACEHOLDERS, dateToBerlinLocal, incidentCallRoles, listKinds, renderCall } from "@/lib/services/schedule";
import { requirePermission } from "@/lib/session";
import { cancelCallAction, createCallAction, deleteCallAction, deleteKindAction, deleteTemplateAction, saveIncidentRolesAction, saveKindAction, saveTemplateAction, sendCallAction, updateCallAction } from "../admin/actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, MessageKey> = { scheduled: "schedule.status.scheduled", draft: "schedule.status.draft", sent: "schedule.status.sent", cancelled: "schedule.status.cancelled", sending: "schedule.status.sending" };
const KIND: Record<(typeof CALL_KINDS)[number], MessageKey> = { ATTACK: "schedule.kind.ATTACK", DEFF: "schedule.kind.DEFF", ATTACK_DAY: "schedule.kind.ATTACK_DAY", OTHER: "schedule.kind.OTHER" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { t, locale } = await getT();
  const when = (d: Date | null) => (d ? fmtDate(d, locale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");
  const kinds = await listKinds(db);
  const incidentRoles = await incidentCallRoles(db);
  const kindLabel = (k: string) => (k in KIND ? t(KIND[k as keyof typeof KIND]) : (kinds.find((x) => x.key === k)?.label ?? k));
  const kindOptions = kinds.map((k) => <option key={k.key} value={k.key}>{kindLabel(k.key)}</option>);
  const statusLabel = (s: string) => (STATUS[s] ? t(STATUS[s]) : s);
  const user = await requirePermission("schedule.view");
  const { error, ok } = await searchParams;
  const manage = hasPermission(user.role, "schedule.manage", await loadMatrix(db));
  const [calls, templates, channels] = await Promise.all([
    db.allianceCall.findMany({ orderBy: [{ at: "asc" }, { id: "desc" }], take: 80 }),
    db.callTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    db.channel.findMany({ where: { tree: "ALLY", archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  const now = Date.now();
  const termin = (c: { eventAt: Date | null; at: Date | null }) => c.eventAt ?? c.at;
  // Anstehend: alles Ungesendete plus bereits gesendete Calls, deren Termin noch bevorsteht
  const open = calls.filter((c) => c.status === "scheduled" || c.status === "draft" || (c.status === "sent" && (termin(c)?.getTime() ?? 0) > now))
    .sort((a, b) => (termin(a)?.getTime() ?? Infinity) - (termin(b)?.getTime() ?? Infinity));
  const done = calls.filter((c) => !open.includes(c) && (c.status === "sent" || c.status === "cancelled")).sort((a, b) => (b.sentAt ?? b.createdAt).getTime() - (a.sentAt ?? a.createdAt).getTime()).slice(0, 20);
  const chName = new Map(channels.map((c) => [c.id, c.name]));
  return (
    <>
      <header>
        <div className="sub">{t("schedule.eyebrow")}</div>
        <h1>{t("schedule.title")}</h1>
        <p className="sub" style={{ marginTop: 4 }}>{t("schedule.intro")}</p>
      </header>
      {error && <p className="errtext" role="alert" style={{ border: "1px solid var(--bad, #a33a2b)", borderRadius: 10, padding: "10px 14px", fontWeight: 700 }}>⚠ {error}</p>}
      {ok && !error && <p role="status" style={{ border: "1px solid #5e7f3a", background: "#dde8c9", color: "#3c5a1e", borderRadius: 10, padding: "10px 14px", fontWeight: 700 }}>✔ {t(`schedule.ok.${ok}` as MessageKey)}</p>}

      {manage && (
        <section className="card" aria-labelledby="new">
          <h2 id="new">{t("schedule.new.title")}</h2>
          <form action={createCallAction} className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
            <div><label className="lbl" htmlFor="kind">{t("schedule.new.kind")}</label>
              <select id="kind" name="kind" className="field" style={{ width: "auto" }}>{kindOptions}</select></div>
            <div><label className="lbl" htmlFor="coord-x">{t("schedule.new.coords")}</label>
              <CoordInput name="coord" idPrefix="coord" /></div>
            <div><label className="lbl" htmlFor="eventAt">{t("schedule.new.eventAt")}</label>
              <input id="eventAt" name="eventAt" type="datetime-local" className="field" style={{ width: "auto" }} /></div>
            <div><label className="lbl" htmlFor="at">{t("schedule.new.sendAt")}</label>
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
          <div className="scroll"><table style={{ minWidth: 900 }}>
            <thead><tr><th>{t("schedule.col.eventAt")}</th><th>{t("schedule.col.sendAt")}</th><th>{t("schedule.col.kind")}</th><th>{t("schedule.col.target")}</th><th>{t("schedule.col.channel")}</th><th>{t("schedule.col.status")}</th><th>{t("schedule.col.preview")}</th><th /></tr></thead>
            <tbody>{open.map((c) => (
              <tr key={c.id}>
                <td>{when(c.eventAt)}</td><td>{c.status === "sent" ? <span className="sub">{when(c.sentAt)}</span> : when(c.at)}</td><td>{kindLabel(c.kind)}</td>
                <td>{c.playerName ? <>{c.playerName} <span className="mono sub"><CoordLink x={c.x!} y={c.y!} className="mono sub" /></span></> : c.title || "–"}</td>
                <td>{chName.get(c.channelId) ?? "?"}</td><td><span className={`pill ${c.status === "sent" ? "p-ok" : "p-wait"}`}>{statusLabel(c.status)}</span></td>
                <td className="sub" style={{ maxWidth: 280, whiteSpace: "pre-wrap", fontSize: 12 }}>{renderCall({ ...c, kindName: kinds.find((k) => k.key === c.kind)?.label })}</td>
                <td className="r">{manage && (
                  <details>
                    <summary className="btn ghost sm" style={{ display: "inline-flex" }}>{t("schedule.edit")}</summary>
                    <form action={updateCallAction} className="col" style={{ gap: 6, marginTop: 8, textAlign: "left", minWidth: 250 }}>
                      <input type="hidden" name="callId" value={c.id} />
                      <label className="lbl">{t("schedule.new.coords")}<CoordInput name="coord" idPrefix={`ec${c.id}`} defaultValue={c.x !== null && c.y !== null ? `${c.x}|${c.y}` : ""} /></label>
                      <label className="lbl">{t("schedule.new.eventAt")}<input name="eventAt" type="datetime-local" className="field" defaultValue={dateToBerlinLocal(c.eventAt)} /></label>
                      {c.status !== "sent" && <label className="lbl">{t("schedule.new.sendAt")}<input name="at" type="datetime-local" className="field" defaultValue={dateToBerlinLocal(c.at)} /></label>}
                      <label className="lbl">{t("schedule.new.titleOpt")}<input name="title" className="field" maxLength={80} defaultValue={c.title} /></label>
                      <label className="lbl">{t("schedule.new.note")}<input name="note" className="field" maxLength={500} defaultValue={c.note} /></label>
                      {c.status === "sent" && <><p className="sub" style={{ fontSize: 12 }}>{t("schedule.edit.notifyHint")}</p><label className="sub" style={{ fontSize: 13 }}><input type="checkbox" name="mail" /> {t("schedule.edit.mail")}</label></>}
                      <button className="btn sm">{t("schedule.tpl.save")}</button>
                    </form>
                    <form action={cancelCallAction} style={{ marginTop: 6 }}>
                      <input type="hidden" name="callId" value={c.id} />
                      {c.status === "sent" && <label className="sub" style={{ fontSize: 13, display: "block" }}><input type="checkbox" name="mail" /> {t("schedule.edit.mail")}</label>}
                      <button className="btn ghost sm">{c.status === "sent" ? t("schedule.cancelSent") : t("schedule.cancel")}</button>
                    </form>
                    {c.status !== "sent" && <form action={sendCallAction} style={{ marginTop: 6 }}><input type="hidden" name="callId" value={c.id} /><button className="btn sm">{t("schedule.sendNow")}</button></form>}
                  </details>)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      {done.length > 0 && (
        <section className="card flush" aria-labelledby="done">
          <h2 id="done" style={{ margin: "12px 12px 8px" }}>{t("schedule.recent")}</h2>
          <div className="scroll"><table style={{ minWidth: 560 }}>
            <tbody>{done.map((c) => (
              <tr key={c.id}><td>{when(c.eventAt ?? c.sentAt ?? c.at)}</td><td>{kindLabel(c.kind)}</td><td>{c.playerName ?? c.title ?? "–"}</td><td>{chName.get(c.channelId) ?? "?"}</td><td>{statusLabel(c.status)}</td>
                <td className="r">{manage && <form action={deleteCallAction}><input type="hidden" name="callId" value={c.id} /><button className="btn ghost sm">{t("schedule.delete")}</button></form>}</td></tr>))}</tbody>
          </table></div>
        </section>
      )}

      {manage && (
        <section className="card" aria-labelledby="kinds">
          <h2 id="kinds">{t("schedule.kinds.title")}</h2>
          <p className="sub" style={{ fontSize: 12, margin: "4px 0 10px" }}>{t("schedule.kinds.intro")}</p>
          <h3 style={{ marginTop: 6 }}>{t("schedule.incident.title")}</h3>
          <p className="sub" style={{ fontSize: 12, margin: "4px 0 8px" }}>{t("schedule.incident.intro")}</p>
          <form action={saveIncidentRolesAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 10, marginBottom: 12 }}>
            {kinds.map((k) => (
              <div key={k.key}><label className="lbl" htmlFor={`ir-${k.key}`}>{kindLabel(k.key)}</label>
                <select id={`ir-${k.key}`} name={`role:${k.key}`} className="field" defaultValue={incidentRoles.get(k.key) ?? ""}>
                  <option value="">{t("schedule.incident.off")}</option>
                  <option value="GUEST">{t("schedule.incident.from", { role: t("common.role.guest") })}</option>
                  <option value="MEMBER">{t("schedule.incident.from", { role: t("common.role.member") })}</option>
                  <option value="MODERATOR">{t("schedule.incident.from", { role: t("common.role.moderator") })}</option>
                </select></div>
            ))}
            <div style={{ alignSelf: "end" }}><button className="btn ghost sm">{t("schedule.incident.save")}</button></div>
          </form>
          {kinds.filter((k) => k.custom).map((k) => (
            <form key={k.key} action={deleteKindAction} className="row" style={{ gap: 8, padding: "4px 0" }}>
              <input type="hidden" name="kindId" value={k.key.split(":")[1]} />
              <span>{k.label}{k.needsCoords ? ` · ${t("schedule.kinds.needsCoords")}` : ""}</span>
              <button className="btn ghost sm">{t("schedule.delete")}</button>
            </form>
          ))}
          <form action={saveKindAction} className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <input name="name" required minLength={2} maxLength={40} className="field" placeholder={t("schedule.kinds.newName")} aria-label={t("schedule.kinds.newName")} style={{ minHeight: 36, flex: "1 1 160px" }} />
            <label className="sub" style={{ fontSize: 13 }}><input type="checkbox" name="needsCoords" /> {t("schedule.kinds.needsCoords")}</label>
            <button className="btn ghost sm">{t("schedule.kinds.create")}</button>
          </form>
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
                <select name="kind" defaultValue={tpl.kind} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("schedule.tpl.kind")}>{kindOptions}</select>
                <select name="channelId" defaultValue={tpl.channelId ?? ""} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("schedule.tpl.defaultChannel")}><option value="">{t("schedule.tpl.firstChannel")}</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <label className="sub" style={{ fontSize: 13, display: "block", marginTop: 8 }}><input type="checkbox" name="sendDm" defaultChecked={tpl.sendDm} /> {t("schedule.tpl.sendDm")}</label>
              <textarea name="body" defaultValue={tpl.body} rows={4} className="field" aria-label={t("schedule.tpl.body")} style={{ width: "100%", marginTop: 8, fontFamily: "inherit" }} />
              <div className="row" style={{ marginTop: 6 }}><button className="btn ghost sm">{t("schedule.tpl.save")}</button><button formAction={deleteTemplateAction} className="btn ghost sm">{t("schedule.delete")}</button></div>
            </form>
          ))}
          <form action={saveTemplateAction} style={{ borderTop: "1px solid var(--line2)", padding: "10px 0 0" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <input name="name" required minLength={2} className="field" placeholder={t("schedule.tpl.newName")} aria-label={t("schedule.tpl.newName")} style={{ minHeight: 36, flex: "1 1 160px" }} />
              <select name="kind" className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("schedule.tpl.newKind")}>{kindOptions}</select>
              <select name="channelId" className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("schedule.tpl.defaultChannel")}><option value="">{t("schedule.tpl.firstChannel")}</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <label className="sub" style={{ fontSize: 13, display: "block", marginTop: 8 }}><input type="checkbox" name="sendDm" /> {t("schedule.tpl.sendDm")}</label>
            <textarea name="body" required rows={3} className="field" aria-label={t("schedule.tpl.newBody")} placeholder={t("schedule.tpl.newBodyPh")} style={{ width: "100%", marginTop: 8, fontFamily: "inherit" }} />
            <button className="btn ghost sm" style={{ marginTop: 6 }}>{t("schedule.tpl.create")}</button>
          </form>
        </section>
      )}
    </>
  );
}
