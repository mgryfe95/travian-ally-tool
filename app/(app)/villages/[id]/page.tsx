import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadBox } from "@/components/UploadBox";
import { VillageSwitch } from "@/components/VillageSwitch";
import { db } from "@/lib/db";
import { fmt, fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { ageInDays, type StateArea } from "@/lib/reminders";
import { getOwnVillage, getStaleDays, getVillageInstructions, ownVillages } from "@/lib/services/villages";
import { requireUser } from "@/lib/session";
import { readTroops, troopsToText } from "@/lib/troops";
import { saveTroopsAction, saveVillageInstructionsAction } from "../actions";

export const dynamic = "force-dynamic";

type Res4 = { wood?: number | null; clay?: number | null; iron?: number | null; crop?: number | null };
type ResState = { stock?: Res4; production?: Res4; productionGross?: Res4; merchants?: string | null; freeCrop?: number | null };
type Level = { slot?: number | null; name?: string | null; level: number };
type QueueItem = { building: string; level: number | null; remaining?: string | null; finishAt?: string | null };
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = <T,>(v: unknown): T => ((v && typeof v === "object" && !Array.isArray(v) ? v : {}) as T);
const RES_ROWS = [["wood", "villages.res.wood"], ["clay", "villages.res.clay"], ["iron", "villages.res.iron"], ["crop", "villages.res.crop"]] as const;

const AREAS: { area: StateArea; title: MessageKey; desc: MessageKey; action: MessageKey; at: "troopsAt" | "buildingsAt" | "resourcesAt" }[] = [
  { area: "troops", title: "villages.area.troops.title", desc: "villages.area.troops.desc", action: "villages.area.troops.action", at: "troopsAt" },
  { area: "buildings", title: "villages.area.buildings.title", desc: "villages.area.buildings.desc", action: "villages.area.buildings.action", at: "buildingsAt" },
  { area: "resources", title: "villages.area.resources.title", desc: "villages.area.resources.desc", action: "villages.area.resources.action", at: "resourcesAt" },
];

export default async function VillagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { t, locale } = await getT();
  const num = (v: number | null | undefined) => (typeof v === "number" ? fmt(v, locale) : "–");
  const signed = (v: number | null | undefined) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${fmt(v, locale)}` : "–");
  const ageLabel = (age: number | null) => (age === null ? t("villages.age.never") : age <= 0 ? t("villages.age.today") : age === 1 ? t("villages.age.yesterday") : t("villages.age.daysAgo", { n: age }));
  const user = await requireUser();
  const id = Number((await params).id);
  const { error, saved } = await searchParams;
  // Fremde Dörfer: 404, kein Hinweis auf Existenz.
  const village = Number.isInteger(id) ? await getOwnVillage(db, user.id, id) : null;
  if (!village) notFound();
  const [all, me, instructions, staleDays] = await Promise.all([
    ownVillages(db, user.id), db.user.findUnique({ where: { id: user.id }, select: { aiInstructions: true } }), getVillageInstructions(db, user.id, id), getStaleDays(db),
  ]);
  const now = new Date();
  const s = village.state;
  const troops = readTroops(s?.troops);
  const res = obj<ResState>(s?.resources);
  const fields = arr<Level>(s?.fields);
  const buildings = arr<Level>(s?.buildings);
  const queue = arr<QueueItem>(obj<{ construction?: unknown }>(s?.queues).construction);

  return (
    <>
      <header className="row between" style={{ alignItems: "flex-end" }}>
        <div>
          <Link href="/" style={{ fontSize: 13 }}>{t("villages.back")}</Link>
          <h1>{village.name} <span className="mono sub" style={{ fontSize: 18, fontWeight: 400 }}>({village.x}|{village.y})</span></h1>
          <div className="sub">{t("villages.population", { n: fmt(village.population, locale) })}</div>
        </div>
        <VillageSwitch villages={all.map((v) => ({ id: v.id, label: `${v.name} (${v.x}|${v.y})` }))} current={id} />
      </header>

      <section aria-label={t("villages.upload.section")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 }}>
          {AREAS.map((a) => {
            const age = ageInDays(s?.[a.at] ?? null, now);
            const old = age === null || age >= staleDays;
            return (
              <div key={a.area} id={`up-${a.area}`} className={`card ${old ? "warn" : ""}`}>
                <div className="row between"><div style={{ fontWeight: 600, fontSize: 15 }}>{t(a.title)}</div><span className={old ? "stale" : "sub"} style={{ fontSize: 12 }}>{ageLabel(age)}</span></div>
                <div className="sub" style={{ margin: "6px 0 12px" }}>{t(a.desc)}</div>
                <UploadBox id={`file-${a.area}`} villageId={id} label={t(a.action)} />
              </div>
            );
          })}
        </div>
        <div className="sub" style={{ marginTop: 8, fontSize: 12 }}>{t("villages.upload.hint")}</div>
      </section>

      <section id="desc" className="card hi" aria-labelledby="desc-h">
        <div className="row between" style={{ alignItems: "baseline" }}><h2 id="desc-h">{t("villages.instr.title", { name: village.name })}</h2><Link href="/#strategie" style={{ fontSize: 13 }}>{t("villages.instr.editAccount")}</Link></div>
        <div style={{ margin: "10px 0", padding: "10px 12px", borderRadius: 8, background: "#191612", fontSize: 13, color: "var(--text2)" }}>
          <span className="sub">{t("villages.instr.inherited")}</span> {me?.aiInstructions ? me.aiInstructions : <em className="sub">{t("villages.instr.none")}</em>}
        </div>
        <form action={saveVillageInstructionsAction}>
          <input type="hidden" name="villageId" value={id} />
          <label htmlFor="vdesc" className="sub" style={{ display: "block", marginBottom: 6 }}>{t("villages.instr.label")}</label>
          <textarea id="vdesc" name="text" rows={3} className="field" maxLength={4000} defaultValue={instructions} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn">{t("villages.save")}</button>
            {saved && <span className="sub" role="status">{t("villages.saved")}</span>}
            {error && <span className="errtext" role="alert">{error}</span>}
          </div>
        </form>
      </section>

      <section className="card hi" aria-labelledby="tips">
        <h2 id="tips">{t("villages.tips.title", { name: village.name })}</h2>
        <div className="sub" style={{ margin: "4px 0 10px" }}>{t("villages.tips.sub")}</div>
        <p className="sub">{t("villages.tips.none")}</p>
      </section>

      <div className="grid2">
        <section className="card" aria-labelledby="res">
          <div className="row between" style={{ alignItems: "baseline" }}><h2 id="res">{t("villages.res.title")}</h2><span className="sub" style={{ fontSize: 12 }}>{s?.resourcesAt ? t("villages.res.asOf", { date: fmtDate(s.resourcesAt, locale) }) : ""}</span></div>
          {s?.resources ? (
            <div className="scroll" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>{t("villages.res.resource")}</th><th className="r">{t("villages.res.stock")}</th><th className="r">{t("villages.res.production")}</th>{res.productionGross && <th className="r">{t("villages.res.gross")}</th>}</tr></thead>
                <tbody>{RES_ROWS.map(([k, label]) => (
                  <tr key={k}><td>{t(label)}</td><td className="mono r">{num(res.stock?.[k])}</td><td className="mono r">{signed(res.production?.[k])}</td>{res.productionGross && <td className="mono r">{num(res.productionGross[k])}</td>}</tr>
                ))}</tbody>
              </table>
              <p className="sub" style={{ fontSize: 12, marginTop: 6 }}>{[res.merchants ? t("villages.res.merchants", { value: res.merchants }) : null, typeof res.freeCrop === "number" ? t("villages.res.freeCrop", { n: fmt(res.freeCrop, locale) }) : null].filter(Boolean).join(" · ")}</p>
            </div>
          ) : <p className="sub" style={{ marginTop: 10 }}>{t("villages.res.empty")}</p>}
          {fields.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="sub" style={{ fontSize: 12, marginBottom: 4 }}>{t("villages.res.fields")}</div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{fields.map((f, i) => <span key={i} className="pill p-none mono">{f.level}</span>)}</div>
            </div>
          )}
        </section>
        <section id="trp" className="card" aria-labelledby="trp-h">
          <div className="row between" style={{ alignItems: "baseline" }}><h2 id="trp-h">{t("villages.troops.title")}</h2><span className={s?.troopsAt && (ageInDays(s.troopsAt, now) ?? 0) >= staleDays ? "stale" : "sub"} style={{ fontSize: 12 }}>{s?.troopsAt ? t("villages.troops.asOf", { age: ageLabel(ageInDays(s.troopsAt, now)) }) : t("villages.troops.never")}</span></div>
          {troops.length > 0 && (
            <div className="scroll" style={{ marginTop: 8 }}><table><thead><tr><th>{t("villages.troops.unit")}</th><th className="r">{t("villages.troops.inVillage")}</th><th className="r">{t("villages.troops.away")}</th><th className="r">{t("villages.troops.support")}</th></tr></thead>
              <tbody>{troops.map((tr) => <tr key={tr.unit}><td>{tr.unit}</td><td className="mono r">{fmt(tr.inVillage, locale)}</td><td className="mono r">{fmt(tr.away, locale)}</td><td className="mono r">{fmt(tr.support, locale)}</td></tr>)}</tbody></table></div>
          )}
          <form action={saveTroopsAction} style={{ marginTop: 12 }}>
            <input type="hidden" name="villageId" value={id} />
            <label htmlFor="troops-text" className="lbl">{t("villages.troops.manual")}</label>
            <textarea id="troops-text" name="text" rows={5} className="field mono" defaultValue={troopsToText(troops)} placeholder={t("villages.troops.placeholder")} />
            <div className="row" style={{ marginTop: 8 }}><button className="btn sm">{t("villages.troops.save")}</button></div>
          </form>
          <p className="sub" style={{ marginTop: 8, fontSize: 12 }}>{t("villages.troops.note")} <strong>{t("villages.troops.noteStrong")}</strong> {t("villages.troops.noteRest")}</p>
        </section>
      </div>

      <section className="card flush" aria-labelledby="bld">
        <div className="row between" style={{ alignItems: "baseline", margin: "12px 12px 8px" }}><h2 id="bld">{t("villages.bld.title")}</h2><span className="sub" style={{ fontSize: 12 }}>{t("villages.bld.later")} <Link href="/gamedata">{t("villages.bld.gamedata")}</Link></span></div>
        <div className="scroll">
          <table style={{ minWidth: 720 }}>
            <thead><tr><th>{t("villages.bld.building")}</th><th>{t("villages.bld.level")}</th><th>{t("villages.bld.benefit")}</th><th>{t("villages.bld.nextCost")}</th><th>{t("villages.bld.benefitAfter")}</th></tr></thead>
            <tbody>
              {buildings.length === 0 && <tr><td colSpan={5} className="sub">{t("villages.bld.empty")}</td></tr>}
              {buildings.map((b, i) => <tr key={i}><td>{b.name ?? t("villages.bld.fallbackName", { n: i + 1 })}</td><td className="mono">{b.level}</td><td className="sub">–</td><td className="sub">–</td><td className="sub">–</td></tr>)}
              {queue.map((q, i) => <tr key={`q${i}`}><td>{q.building} <span className="pill p-wait">{t("villages.bld.building.inProgress")}</span></td><td className="mono">→ {q.level ?? "?"}</td><td className="sub" colSpan={3}>{[q.remaining ? t("villages.bld.remaining", { time: q.remaining }) : null, q.finishAt ? t("villages.bld.finished", { time: q.finishAt }) : null].filter(Boolean).join(" · ")}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
