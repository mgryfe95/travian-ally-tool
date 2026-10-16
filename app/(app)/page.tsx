import { CoordLink } from "@/components/CoordLink";
import Link from "next/link";
import { Fragment } from "react";
import { UploadBox } from "@/components/UploadBox";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey, T } from "@/lib/i18n";
import { ageInDays, staleReminders } from "@/lib/reminders";
import { getStaleDays, ownVillages } from "@/lib/services/villages";
import { requireUser } from "@/lib/session";
import { saveAccountInstructionsAction } from "./villages/actions";

export const dynamic = "force-dynamic";

/** `ageLabel` aus lib/reminders mit Übersetzung (lib/reminders.ts enthält noch deutsche Texte). */
const ageText = (t: T, age: number | null) => (age === null ? t("overview.age.never") : age <= 0 ? t("overview.age.today") : age === 1 ? t("overview.age.yesterday") : t("overview.age.daysAgo", { n: age }));

const AREA_WHAT = { troops: "overview.area.troops.what", resources: "overview.area.resources.what", buildings: "overview.area.buildings.what" } as const satisfies Record<string, MessageKey>;
const AREA_ACTION = { troops: "overview.area.troops.action", resources: "overview.area.resources.action", buildings: "overview.area.buildings.action" } as const satisfies Record<string, MessageKey>;

/** Satz mit Platzhaltern `{name}`, die durch React-Knoten ersetzt werden. */
function Rich({ tpl, parts }: { tpl: string; parts: Record<string, React.ReactNode> }) {
  return <>{tpl.split(/(\{\w+\})/).map((s, i) => { const k = /^\{(\w+)\}$/.exec(s)?.[1]; return k !== undefined && k in parts ? <Fragment key={i}>{parts[k]}</Fragment> : s; })}</>;
}

export default async function Overview({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { t, locale } = await getT();
  const user = await requireUser();
  const { error, saved } = await searchParams;
  const villages = await ownVillages(db, user.id);
  const me = await db.user.findUnique({ where: { id: user.id }, select: { aiInstructions: true } });
  const staleDays = await getStaleDays(db);
  const now = new Date();
  const reminders = staleReminders(villages.map((v) => ({ villageId: v.id, villageName: v.name, troopsAt: v.state?.troopsAt ?? null, resourcesAt: v.state?.resourcesAt ?? null, buildingsAt: v.state?.buildingsAt ?? null })), staleDays, now);
  const stale = (at: Date | null) => { const a = ageInDays(at, now); return a === null || a >= staleDays; };

  if (villages.length === 0) {
    return (
      <>
        <header><div className="sub">{t("overview.title")}</div><h1>{t("overview.welcome.title", { name: user.name })}</h1></header>
        <section className="card hi">
          <h2>{t("overview.welcome.noPlayer")}</h2>
          <p className="sub" style={{ margin: "6px 0 12px" }}>{t("overview.welcome.noPlayerText")}</p>
          <Link className="btn" href="/claim">{t("overview.welcome.claim")}</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="row between" style={{ alignItems: "flex-end" }}>
        <div><div className="sub">{t("overview.title")}</div><h1>{t(villages.length === 1 ? "overview.heading.one" : "overview.heading.other", { n: villages.length })}</h1></div>
        <div className="row"><a className="btn ghost" href="#strategie">{t("overview.nav.instructions")}</a><a className="btn" href="#upload">{t("overview.nav.upload")}</a></div>
      </header>

      <section id="strategie" className="card hi" aria-labelledby="st">
        <div className="row between" style={{ alignItems: "baseline" }}><h2 id="st">{t("overview.instr.title")}</h2><span className="sub" style={{ fontSize: 12 }}>{t("overview.instr.scope")}</span></div>
        <form action={saveAccountInstructionsAction}>
          <input type="hidden" name="back" value="/" />
          <label htmlFor="strat" className="sub" style={{ display: "block", margin: "6px 0" }}>{t("overview.instr.label")}</label>
          <textarea id="strat" name="text" rows={3} className="field" maxLength={4000} defaultValue={me?.aiInstructions ?? ""} placeholder={t("overview.instr.placeholder")} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn">{t("overview.instr.save")}</button>
            {villages[0] && <Link className="btn ghost" href={`/villages/${villages[0].id}#desc`}>{t("overview.instr.editVillage")}</Link>}
            {saved && <span className="sub" role="status">{t("overview.instr.saved")}</span>}
            {error && <span className="errtext" role="alert">{error}</span>}
          </div>
        </form>
      </section>

      <section className="card warn" aria-labelledby="due">
        <h2 id="due" style={{ color: "var(--warn)", marginBottom: 12 }}>{t("overview.due.title")}</h2>
        {reminders.length === 0 ? <p className="sub">{t("overview.due.allCurrent")}</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reminders.map((r) => (
              <div key={`${r.villageId}-${r.area}`} className="row between" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--raised)" }}>
                <div><Rich tpl={t(r.ageDays === null ? "overview.due.never" : "overview.due.last", { what: "{what}", village: "{village}", age: "{age}" })} parts={{ what: <strong>{t(AREA_WHAT[r.area])}</strong>, village: <Link href={`/villages/${r.villageId}`}>{r.villageName}</Link>, age: <strong className="mono">{ageText(t, r.ageDays)}</strong> }} /></div>
                <Link className="btn ghost sm" href={`/villages/${r.villageId}#up-${r.area}`}>{t(AREA_ACTION[r.area])}</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid2">
        <section className="card" aria-labelledby="tips">
          <h2 id="tips">{t("overview.tips.title")}</h2>
          <p className="sub" style={{ margin: "4px 0 10px" }}>{t("overview.tips.basis")}</p>
          <p className="sub">{t("overview.tips.none")}</p>
        </section>
        <section id="upload" className="card" aria-labelledby="up">
          <h2 id="up">{t("overview.upload.title")}</h2>
          <div className="sub" style={{ margin: "4px 0 14px" }}>{t("overview.upload.text")}</div>
          <UploadBox id="statfile" label={t("overview.upload.label")} hint={t("overview.upload.hint")} />
        </section>
      </div>

      <section className="card flush" aria-labelledby="vil">
        <h2 id="vil" style={{ margin: "12px 12px 8px" }}>{t("overview.villages.title")}</h2>
        <div className="scroll">
          <table style={{ minWidth: 820 }}>
            <thead><tr><th>{t("overview.villages.village")}</th><th>{t("overview.villages.coords")}</th><th>{t("overview.villages.population")}</th><th>{t("overview.villages.production")}</th><th>{t("overview.villages.troops")}</th><th>{t("overview.villages.resources")}</th><th>{t("overview.villages.buildings")}</th><th /></tr></thead>
            <tbody>
              {villages.map((v) => (
                <tr key={v.id}>
                  <td><Link href={`/villages/${v.id}`} style={{ fontWeight: 600 }}>{v.name}</Link></td>
                  <td className="mono"><CoordLink x={v.x} y={v.y} /></td><td className="mono">{fmt(v.population, locale)}</td><td className="mono sub">–</td>
                  <td className={stale(v.state?.troopsAt ?? null) ? "stale" : ""}>{ageText(t, ageInDays(v.state?.troopsAt ?? null, now))}</td>
                  <td className={stale(v.state?.resourcesAt ?? null) ? "stale" : ""}>{ageText(t, ageInDays(v.state?.resourcesAt ?? null, now))}</td>
                  <td className={stale(v.state?.buildingsAt ?? null) ? "stale" : ""}>{ageText(t, ageInDays(v.state?.buildingsAt ?? null, now))}</td>
                  <td><Link href={`/villages/${v.id}`}>{t("overview.villages.open")}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
