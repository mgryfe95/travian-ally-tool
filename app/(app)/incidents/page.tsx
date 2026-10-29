import Link from "next/link";
import { UploadBox } from "@/components/UploadBox";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { listIncidents } from "@/lib/services/incidents";
import { searchMemory } from "@/lib/services/memory";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission("incidents.report", "incidents.view");
  const { t, locale } = await getT();
  const matrix = await loadMatrix(db);
  const canReport = hasPermission(user.role, "incidents.report", matrix);
  const canAll = hasPermission(user.role, "incidents.view", matrix);
  const { q } = await searchParams;
  const hits = canReport && q ? await searchMemory(db, user.id, q) : [];
  const mine = await listIncidents(db, user);
  const all = canAll ? (await listIncidents(db, user, { all: true, openOnly: true })) : [];
  const ids = [...new Set([...mine, ...all].map((i) => i.villageId))];
  const villages = new Map((await db.village.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, x: true, y: true } })).map((v) => [v.id, v]));
  const users = new Map((await db.user.findMany({ where: { id: { in: [...new Set(all.map((i) => i.userId))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const now = new Date();

  const table = (rows: typeof mine, withPlayer: boolean) => rows.length === 0 ? <p className="sub" style={{ margin: 12 }}>{t("incidents.none")}</p> : (
    <div className="scroll">
      <table>
        <thead><tr><th>{t("incidents.col.date")}</th>{withPlayer && <th>{t("incidents.col.player")}</th>}<th>{t("incidents.col.village")}</th><th>{t("incidents.col.kind")}</th><th>{t("incidents.col.attacker")}</th><th>{t("incidents.col.status")}</th></tr></thead>
        <tbody>{rows.map((i) => { const v = villages.get(i.villageId); return (
          <tr key={i.id}>
            <td><Link href={`/incidents/${i.id}`}>{fmtDate(i.createdAt, locale)}</Link></td>
            {withPlayer && <td>{users.get(i.userId) ?? "?"}</td>}
            <td>{v ? `${v.name} (${v.x}|${v.y})` : "?"}</td>
            <td>{t(`incidents.kind.${i.kind}` as MessageKey)}</td>
            <td>{i.attackerName || (i.attackerX !== null ? `(${i.attackerX}|${i.attackerY})` : "–")}{i.attackerAlliance ? ` [${i.attackerAlliance}]` : ""}</td>
            <td>{t(`incidents.status.${i.status}` as MessageKey)}{i.status === "open" && i.threatUntil > now ? <span className="sub"> · {t("incidents.threat", { date: fmtDate(i.threatUntil, locale, { dateStyle: "short" }) })}</span> : null}</td>
          </tr>); })}</tbody>
      </table>
    </div>
  );

  return (
    <>
      <header><div className="sub">{t("incidents.eyebrow")}</div><h1>{t("incidents.title")}</h1></header>
      <section className="card soft" aria-labelledby="inc-what">
        <h2 id="inc-what">{t("incidents.what.h")}</h2>
        <p style={{ marginTop: 6 }}>{t("incidents.what.p")}</p>
      </section>
      {canReport && (
        <section className="card hi" aria-labelledby="inc-new">
          <h2 id="inc-new">{t("incidents.new.title")}</h2>
          <p className="sub" style={{ margin: "4px 0 12px" }}>{t("incidents.how")}</p>
          <UploadBox id="inc-shot" label={t("incidents.upload.label")} kinds={["BATTLE_REPORT"]} defaultKind="BATTLE_REPORT" nextHref="/incidents/new?shot={id}" />
          <p style={{ marginTop: 10 }}><Link className="btn ghost" href="/incidents/new">{t("incidents.manual")}</Link></p>
        </section>
      )}
      {canReport && <section className="card flush" aria-labelledby="inc-mine"><h2 id="inc-mine" style={{ margin: "12px 12px 8px" }}>{t("incidents.mine")}</h2>{table(mine, false)}</section>}
      {canReport && (
        <section className="card" aria-labelledby="inc-search">
          <h2 id="inc-search">{t("incidents.search.title")}</h2>
          <p className="sub" style={{ margin: "4px 0 10px" }}>{t("incidents.search.sub")}</p>
          <form className="row" style={{ gap: 8 }} role="search">
            <input name="q" className="field" defaultValue={q ?? ""} maxLength={200} aria-label={t("incidents.search.title")} placeholder={t("incidents.search.ph")} style={{ flex: "1 1 220px" }} />
            <button className="btn ghost">{t("incidents.search.go")}</button>
          </form>
          {q && (hits.length === 0 ? <p className="sub" style={{ marginTop: 10 }}>{t("incidents.search.none")}</p> : (
            <ul style={{ marginTop: 10, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {hits.map((h) => <li key={h.id}>{h.sourceType === "incident" && h.sourceId ? <Link href={`/incidents/${h.sourceId}`}>{h.title}</Link> : <b>{h.title}</b>} <span className="sub">· {fmtDate(h.updatedAt, locale, { dateStyle: "short" })} · {h.body}</span></li>)}
            </ul>
          ))}
        </section>
      )}
      {canAll && <section className="card flush" aria-labelledby="inc-all"><h2 id="inc-all" style={{ margin: "12px 12px 8px" }}>{t("incidents.all")}</h2>{table(all, true)}</section>}
    </>
  );
}
