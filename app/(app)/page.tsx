import Link from "next/link";
import { UploadBox } from "@/components/UploadBox";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { AREA_LABEL, ageInDays, ageLabel, staleReminders } from "@/lib/reminders";
import { getStaleDays, ownVillages } from "@/lib/services/villages";
import { requireUser } from "@/lib/session";
import { saveAccountInstructionsAction } from "./villages/actions";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
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
        <header><div className="sub">Übersicht</div><h1>Willkommen, {user.name}</h1></header>
        <section className="card hi">
          <h2>Noch kein Spieler verknüpft</h2>
          <p className="sub" style={{ margin: "6px 0 12px" }}>Sobald dein Konto mit deinem Travian-Spieler verifiziert ist, erscheinen hier deine Dörfer, Aktualisierungs-Erinnerungen und KI-Empfehlungen.</p>
          <Link className="btn" href="/claim">Spieler verknüpfen</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="row between" style={{ alignItems: "flex-end" }}>
        <div><div className="sub">Übersicht</div><h1>Deine {villages.length} {villages.length === 1 ? "Dorf" : "Dörfer"}</h1></div>
        <div className="row"><a className="btn ghost" href="#strategie">KI-Instruktionen</a><a className="btn" href="#upload">Dörferstatistik hochladen</a></div>
      </header>

      <section id="strategie" className="card hi" aria-labelledby="st">
        <div className="row between" style={{ alignItems: "baseline" }}><h2 id="st">KI-Instruktionen für deinen Account</h2><span className="sub" style={{ fontSize: 12 }}>gilt für alle Dörfer · Dorf-Instruktionen ergänzen sie je Dorf</span></div>
        <form action={saveAccountInstructionsAction}>
          <input type="hidden" name="back" value="/" />
          <label htmlFor="strat" className="sub" style={{ display: "block", margin: "6px 0" }}>Deine dorfübergreifende Strategie – fließt in jede Empfehlung auf dieser Seite und in allen Dorf-Dashboards ein.</label>
          <textarea id="strat" name="text" rows={3} className="field" maxLength={4000} defaultValue={me?.aiInstructions ?? ""} placeholder="z. B. Off-Account, Hammerdorf im Hauptdorf, zwei Versorger …" />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn">Speichern</button>
            {villages[0] && <Link className="btn ghost" href={`/villages/${villages[0].id}#desc`}>Dorf-Instruktionen bearbeiten</Link>}
            {saved && <span className="sub" role="status">Gespeichert.</span>}
            {error && <span className="errtext" role="alert">{error}</span>}
          </div>
        </form>
      </section>

      <section className="card warn" aria-labelledby="due">
        <h2 id="due" style={{ color: "var(--warn)", marginBottom: 12 }}>Aktualisierungen fällig</h2>
        {reminders.length === 0 ? <p className="sub">Alles aktuell.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reminders.map((r) => (
              <div key={`${r.villageId}-${r.area}`} className="row between" style={{ padding: "10px 12px", borderRadius: 8, background: "#1b1611" }}>
                <div>Du hast <strong>{AREA_LABEL[r.area].what}</strong> von <Link href={`/villages/${r.villageId}`}>{r.villageName}</Link> {r.ageDays === null ? "noch nie" : <>zuletzt <strong className="mono">{ageLabel(r.ageDays)}</strong></>} aktualisiert.</div>
                <Link className="btn ghost sm" href={`/villages/${r.villageId}#up-${r.area}`}>{AREA_LABEL[r.area].action}</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid2">
        <section className="card" aria-labelledby="tips">
          <h2 id="tips">KI-Empfehlungen für deinen Account</h2>
          <p className="sub" style={{ margin: "4px 0 10px" }}>Basis: deine Account-Instruktionen und der Stand deiner Screenshots.</p>
          <p className="sub">Noch keine Empfehlungen – die KI-Auswertung wird mit Phase 2 freigeschaltet (Spieldaten und Prompts stehen noch aus).</p>
        </section>
        <section id="upload" className="card" aria-labelledby="up">
          <h2 id="up">Dörferstatistik hochladen</h2>
          <div className="sub" style={{ margin: "4px 0 14px" }}>Ein Screenshot aktualisiert Ressourcen, Truppen und Bauschleifen aller Dörfer auf einmal.</div>
          <UploadBox id="statfile" label="Screenshot hierher ziehen, einfügen (Strg+V) oder auswählen" hint="Desktop oder Mobile wird automatisch erkannt" />
        </section>
      </div>

      <section className="card flush" aria-labelledby="vil">
        <h2 id="vil" style={{ margin: "12px 12px 8px" }}>Dörfer</h2>
        <div className="scroll">
          <table style={{ minWidth: 820 }}>
            <thead><tr><th>Dorf</th><th>Koordinaten</th><th>Einwohner</th><th>Produktion / h</th><th>Truppen</th><th>Ressourcen</th><th>Gebäude</th><th /></tr></thead>
            <tbody>
              {villages.map((v) => (
                <tr key={v.id}>
                  <td><Link href={`/villages/${v.id}`} style={{ fontWeight: 600 }}>{v.name}</Link></td>
                  <td className="mono">({v.x}|{v.y})</td><td className="mono">{fmt(v.population)}</td><td className="mono sub">–</td>
                  <td className={stale(v.state?.troopsAt ?? null) ? "stale" : ""}>{ageLabel(ageInDays(v.state?.troopsAt ?? null, now))}</td>
                  <td className={stale(v.state?.resourcesAt ?? null) ? "stale" : ""}>{ageLabel(ageInDays(v.state?.resourcesAt ?? null, now))}</td>
                  <td className={stale(v.state?.buildingsAt ?? null) ? "stale" : ""}>{ageLabel(ageInDays(v.state?.buildingsAt ?? null, now))}</td>
                  <td><Link href={`/villages/${v.id}`}>Öffnen</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
