import Link from "next/link";
import { db } from "@/lib/db";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { INCIDENT_KINDS, namedUnits } from "@/lib/incidents";
import { draftFromScreenshot } from "@/lib/services/incidents";
import { ownVillages } from "@/lib/services/villages";
import { requirePermission } from "@/lib/session";
import { createIncidentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage({ searchParams }: { searchParams: Promise<{ shot?: string; error?: string }> }) {
  const user = await requirePermission("incidents.report");
  const { t, locale } = await getT();
  const { shot, error } = await searchParams;
  const shotId = Number(shot);
  const draft = Number.isInteger(shotId) && shotId > 0 ? await draftFromScreenshot(db, user.id, shotId) : null;
  const villages = await ownVillages(db, user.id);
  const own = villages[0] ? await db.player.findUnique({ where: { id: villages[0].playerId }, select: { tribe: true } }) : null;
  const names = own ? await db.unitName.findMany({ where: { tribeVid: own.tribe } }) : [];
  const nameOf = (slot: number) => slot === 11 ? (locale === "de" ? "Held" : "Hero") : (names.find((n) => n.slot === slot)?.[locale === "de" ? "nameDe" : "nameEn"] ?? names.find((n) => n.slot === slot)?.nameEn ?? `#${slot}`);
  const lossesFromShot = draft ? namedUnits(draft.defenderLosses, nameOf) : [];
  const attacker = draft ? (draft.attackerX !== null && draft.attackerY !== null ? `(${draft.attackerX}|${draft.attackerY})` : draft.attackerName) : "";
  const radio = (name: string, opts: readonly string[], def: string) => (
    <div className="row" style={{ gap: 14 }}>{opts.map((o) => <label key={o} className="row" style={{ gap: 6 }}><input type="radio" name={name} value={o} defaultChecked={o === def} /> {t(`incidents.a.${o}` as MessageKey)}</label>)}</div>
  );
  return (
    <>
      <header><Link href="/incidents" style={{ fontSize: 13 }}>{t("incidents.back")}</Link><h1>{t("incidents.new.title")}</h1></header>
      {shot && <p className={draft ? "card soft" : "card warn"} role="status">{draft ? t("incidents.new.fromShot") : t("incidents.new.shotMissing")}</p>}
      {error && <p className="errtext" role="alert">{error}</p>}
      <form action={createIncidentAction} className="card" style={{ display: "grid", gap: 14, maxWidth: 640 }}>
        {draft && <>
          <input type="hidden" name="screenshotId" value={shotId} />
          <input type="hidden" name="attackerUnits" value={JSON.stringify(draft.attackerUnits)} />
          <input type="hidden" name="attackerLosses" value={JSON.stringify(draft.attackerLosses)} />
          <input type="hidden" name="defenderLosses" value={JSON.stringify(draft.defenderLosses)} />
        </>}
        <div><label className="lbl" htmlFor="i-v">{t("incidents.f.village")}</label>
          <select id="i-v" name="villageId" className="field" required defaultValue={draft?.villageId ?? villages[0]?.id}>{villages.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.x}|{v.y})</option>)}</select></div>
        <div><label className="lbl" htmlFor="i-k">{t("incidents.f.kind")}</label>
          <select id="i-k" name="kind" className="field" defaultValue={draft?.kind ?? "attack"}>{INCIDENT_KINDS.map((k) => <option key={k} value={k}>{t(`incidents.kind.${k}`)}</option>)}</select></div>
        <div><label className="lbl" htmlFor="i-w">{t("incidents.f.when")}</label><input id="i-w" name="occurredAt" type="datetime-local" className="field" /></div>
        <div><label className="lbl" htmlFor="i-a">{t("incidents.f.attacker")}</label><input id="i-a" name="attacker" className="field" maxLength={60} defaultValue={attacker} /></div>
        <div><label className="lbl" htmlFor="i-al">{t("incidents.f.alliance")}</label><input id="i-al" name="attackerAlliance" className="field" maxLength={40} defaultValue={draft?.attackerAlliance ?? ""} /></div>
        {draft ? (
          <div><div className="lbl">{t("incidents.f.lossesShot")}</div><p className="mono">{lossesFromShot.length ? lossesFromShot.map((l) => `${l.count} ${l.unit}`).join(", ") : "–"}</p></div>
        ) : (
          <div><label className="lbl" htmlFor="i-l">{t("incidents.f.losses")}</label><textarea id="i-l" name="losses" rows={3} className="field" placeholder={"Keulenschwinger; 120"} /></div>
        )}
        <label className="row" style={{ gap: 8 }}><input type="checkbox" name="correctTroops" value="1" defaultChecked={!!draft} /> {t("incidents.f.correct")}</label>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="lbl">{t("incidents.q.more")}</legend>{radio("moreAttacks", ["yes", "no", "unknown"], "unknown")}</fieldset>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="lbl">{t("incidents.q.ongoing")}</legend>{radio("ongoing", ["yes", "no"], "no")}</fieldset>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="lbl">{t("incidents.q.help")}</legend>{radio("needHelp", ["yes", "no"], "no")}</fieldset>
        <div><label className="lbl" htmlFor="i-n">{t("incidents.f.notes")}</label><textarea id="i-n" name="notes" rows={2} className="field" maxLength={2000} /></div>
        <div><button className="btn">{t("incidents.submit")}</button></div>
      </form>
    </>
  );
}
