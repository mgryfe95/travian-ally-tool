import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmt, fmtDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import type { Answers, UnitCount } from "@/lib/incidents";
import { hasPermission } from "@/lib/permissions";
import { adviceStatus } from "@/lib/services/advice";
import { loadMatrix } from "@/lib/services/context";
import { getIncident, incidentContext } from "@/lib/services/incidents";
import { allowedIncidentKinds } from "@/lib/services/schedule";
import { requirePermission } from "@/lib/session";
import { assessIncidentAction, requestHelpAction, resolveIncidentAction } from "../actions";

export const dynamic = "force-dynamic";

const units = (v: unknown): UnitCount[] => (Array.isArray(v) ? (v as UnitCount[]).filter((u) => u && typeof u.unit === "string" && typeof u.count === "number") : []);

export default async function IncidentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requirePermission("incidents.report", "incidents.view");
  const { t, locale } = await getT();
  const { saved, error } = await searchParams;
  const id = Number((await params).id);
  const i = Number.isInteger(id) ? await getIncident(db, user, id) : null;
  if (!i) notFound();
  const own = i.userId === user.id;
  const ctx = await incidentContext(db, i);
  const a = i.answers as Answers;
  const canAi = own && hasPermission(user.role, "ai.advice", await loadMatrix(db));
  const ai = canAi ? await adviceStatus(db, user, new Date(), i.id) : null;
  const callKinds = own ? await allowedIncidentKinds(db, user) : [];
  const kindLabel = (k: { key: string; label?: string }) => k.label ?? t(`schedule.kind.${k.key}` as MessageKey);
  const run = await db.adviceRun.findFirst({ where: { incidentId: i.id, status: "ok" }, orderBy: { id: "desc" }, include: { recommendations: true } });
  const list = (l: UnitCount[]) => (l.length ? l.map((u) => `${fmt(u.count, locale)} ${u.unit}`).join(", ") : "–");
  const yn = (v: string) => t(`incidents.a.${v}` as MessageKey);

  return (
    <>
      <header>
        <Link href="/incidents" style={{ fontSize: 13 }}>{t("incidents.back")}</Link>
        <h1>{t("incidents.detail.title", { village: ctx.village ? `${ctx.village.name} (${ctx.village.x}|${ctx.village.y})` : "?" })}</h1>
        <div className="sub">{t(`incidents.kind.${i.kind}` as MessageKey)} · {fmtDate(i.occurredAt ?? i.createdAt, locale)} · {t(`incidents.status.${i.status}` as MessageKey)}{i.status === "open" ? ` · ${t("incidents.threat", { date: fmtDate(i.threatUntil, locale, { dateStyle: "short" }) })}` : ""}</div>
      </header>
      {saved && <p className="sub" role="status">{t("incidents.saved")}</p>}
      {error && <p className="errtext" role="alert">{error}</p>}

      <section className="card" aria-labelledby="att">
        <h2 id="att">{t("incidents.detail.attacker")}</h2>
        <p style={{ marginTop: 6 }}><b>{i.attackerName || (i.attackerX !== null ? `(${i.attackerX}|${i.attackerY})` : "?")}</b>{i.attackerAlliance ? ` [${i.attackerAlliance}]` : ""}</p>
        {ctx.attacker ? (
          <p className="sub">{t("incidents.detail.attackerInfo", { pop: fmt(ctx.attacker.population, locale), villages: ctx.attacker.villages, dist: ctx.attacker.nearest ?? "?" })}{ctx.attacker.relation ? ` · ${t("incidents.detail.relation", { rel: t(`admin.relation.${ctx.attacker.relation}` as MessageKey) })}` : ""}</p>
        ) : <p className="sub">{t("incidents.detail.unknownAttacker")}</p>}
        <div className="scroll" style={{ marginTop: 8 }}>
          <table><tbody>
            <tr><td>{t("incidents.detail.attackerUnits")}</td><td>{list(units(i.attackerUnits))}</td></tr>
            <tr><td>{t("incidents.detail.attackerLosses")}</td><td>{list(units(i.attackerLosses))}</td></tr>
            <tr><td>{t("incidents.detail.losses")}</td><td>{list(units(i.defenderLosses))}</td></tr>
          </tbody></table>
        </div>
        {i.troopsCorrected && <p className="sub" style={{ marginTop: 6 }}>{t("incidents.detail.corrected")}</p>}
        <p className="sub" style={{ marginTop: 6 }}>{t("incidents.detail.answers")}: {t("incidents.q.more")} {yn(a.moreAttacks)} · {t("incidents.q.ongoing")} {yn(a.ongoing)} · {t("incidents.q.help")} {yn(a.needHelp)}</p>
        {i.notes && <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{i.notes}</p>}
      </section>

      {own && i.status === "open" && (
        <section className="card" aria-label={t("incidents.help.request")}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {i.helpRequestedAt ? <span className="sub">{t(i.callId ? "incidents.help.doneCall" : "incidents.help.done", { date: fmtDate(i.helpRequestedAt, locale) })}</span> : callKinds.length > 0 ? (
              <form action={requestHelpAction} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={i.id} />
                <label className="sub" htmlFor="hk">{t("incidents.help.kind")}</label>
                <select id="hk" name="kind" className="field" style={{ width: "auto" }} defaultValue={callKinds.some((k) => k.key === "DEFF") ? "DEFF" : callKinds[0]!.key}>
                  {callKinds.map((k) => <option key={k.key} value={k.key}>{kindLabel(k)}</option>)}
                </select>
                <button className="btn">{t("incidents.help.sendCall")}</button>
              </form>
            ) : (
              <form action={requestHelpAction}><input type="hidden" name="id" value={i.id} /><button className="btn">{t("incidents.help.request")}</button></form>
            )}
            <form action={resolveIncidentAction}><input type="hidden" name="id" value={i.id} /><button className="btn ghost">{t("incidents.resolve")}</button></form>
          </div>
        </section>
      )}

      {(canAi || run) && (
        <section id="tips" className="card hi" aria-labelledby="ai">
          <h2 id="ai">{t("incidents.ai.title")}</h2>
          <p className="sub" style={{ margin: "4px 0 10px" }}>{t("incidents.ai.sub")}</p>
          {run && <>
            <p>{run.summary}</p>
            <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>{run.recommendations.sort((x, y) => x.priority - y.priority).map((r) => <li key={r.id}><b>{r.title}</b>{r.reason ? <span className="sub"> – {r.reason}</span> : null}</li>)}</ol>
            {own && <p><Link href="/#tips">{t("advice.overview.title")}</Link></p>}
          </>}
          {ai && !run && (
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <form action={assessIncidentAction}><input type="hidden" name="id" value={i.id} /><button className="btn" disabled={!ai.allowed}>{t("incidents.ai.run")}</button></form>
              {!ai.allowed && ai.reason && <span className="sub">{t(`err.advice.gate.${ai.reason}` as MessageKey)}</span>}
            </div>
          )}
        </section>
      )}
    </>
  );
}
