import Link from "next/link";
import { db } from "@/lib/db";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { INCIDENT_TYPE_KEYS, namedUnits, typeFromKind } from "@/lib/incidents";
import { draftFromScreenshot } from "@/lib/services/incidents";
import { ownVillages } from "@/lib/services/villages";
import { requirePermission } from "@/lib/session";
import { startIncidentAction } from "../actions";

export const dynamic = "force-dynamic";

/** Schlank: Typ, Dorf, eigene Beschreibung (+ optional gelesener Kampfbericht). Den Rest fragt der Klärungs-Chat ab. */
export default async function NewIncidentPage({ searchParams }: { searchParams: Promise<{ shot?: string; error?: string; type?: string }> }) {
  const user = await requirePermission("incidents.report");
  const { t } = await getT();
  const { shot, error, type } = await searchParams;
  const shotId = Number(shot);
  const draft = Number.isInteger(shotId) && shotId > 0 ? await draftFromScreenshot(db, user.id, shotId) : null;
  const villages = await ownVillages(db, user.id);
  const nameOf = (slot: number) => (slot === 11 ? "Hero" : `#${slot}`);
  const att = draft ? (draft.attackerX !== null && draft.attackerY !== null ? `${draft.attackerName || "?"} (${draft.attackerX}|${draft.attackerY})` : draft.attackerName) : "";
  const losses = draft ? namedUnits(draft.defenderLosses, nameOf).length : 0;
  return (
    <>
      <header><Link href="/incidents" style={{ fontSize: 13 }}>{t("incidents.back")}</Link><h1>{t("incidents.new.title")}</h1></header>
      {shot && <p className={draft ? "card soft" : "card warn"} role="status">{draft ? `${t("incidents.new.fromShot")} ${att ? `· ${att}` : ""}${losses ? ` · ${t("incidents.f.lossesShot")}: ${losses}` : ""}` : t("incidents.new.shotMissing")}</p>}
      {error && <p className="errtext" role="alert">{error}</p>}
      <form action={startIncidentAction} className="card" style={{ display: "grid", gap: 14, maxWidth: 640 }}>
        {draft && <input type="hidden" name="screenshotId" value={shotId} />}
        <div><label className="lbl" htmlFor="i-t">{t("incidents.new.type")}</label>
          <select id="i-t" name="type" className="field" defaultValue={draft ? typeFromKind(draft.kind) : INCIDENT_TYPE_KEYS.includes(type as never) ? type : "defense"}>
            {INCIDENT_TYPE_KEYS.map((k) => <option key={k} value={k}>{t(`incidents.type.${k}` as MessageKey)}</option>)}
          </select></div>
        <div><label className="lbl" htmlFor="i-v">{t("incidents.new.village")}</label>
          <select id="i-v" name="villageId" className="field" required defaultValue={draft?.villageId ?? villages[0]?.id}>{villages.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.x}|{v.y})</option>)}</select></div>
        <div><label className="lbl" htmlFor="i-d">{t("incidents.new.desc")}</label>
          <textarea id="i-d" name="description" rows={4} className="field" maxLength={2000} required={!draft} />
          <p className="sub" style={{ fontSize: 12, marginTop: 4 }}>{t("incidents.new.descHint")}</p></div>
        <div><button className="btn">{t("incidents.new.continue")}</button></div>
      </form>
    </>
  );
}
