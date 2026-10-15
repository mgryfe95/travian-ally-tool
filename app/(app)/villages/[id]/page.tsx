import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadBox } from "@/components/UploadBox";
import { VillageSwitch } from "@/components/VillageSwitch";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { AREA_LABEL, ageInDays, ageLabel, type StateArea } from "@/lib/reminders";
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
const num = (v: number | null | undefined) => (typeof v === "number" ? fmt(v) : "–");
const signed = (v: number | null | undefined) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${fmt(v)}` : "–");
const RES_ROWS = [["wood", "Holz"], ["clay", "Lehm"], ["iron", "Eisen"], ["crop", "Getreide"]] as const;

const AREAS: { area: StateArea; title: string; desc: string; at: "troopsAt" | "buildingsAt" | "resourcesAt" }[] = [
  { area: "troops", title: "Truppen", desc: "Screenshot vom Versammlungsplatz (Tab „Truppen“)", at: "troopsAt" },
  { area: "buildings", title: "Dorfansicht", desc: "Gebäude und Stufen im Dorfzentrum", at: "buildingsAt" },
  { area: "resources", title: "Ressourcen", desc: "Ressourcenfelder inkl. Lager und Produktion", at: "resourcesAt" },
];

export default async function VillagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
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
          <Link href="/" style={{ fontSize: 13 }}>← Alle Dörfer</Link>
          <h1>{village.name} <span className="mono sub" style={{ fontSize: 18, fontWeight: 400 }}>({village.x}|{village.y})</span></h1>
          <div className="sub">{fmt(village.population)} Einwohner</div>
        </div>
        <VillageSwitch villages={all.map((v) => ({ id: v.id, label: `${v.name} (${v.x}|${v.y})` }))} current={id} />
      </header>

      <section aria-label="Screenshots hochladen">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 }}>
          {AREAS.map((a) => {
            const age = ageInDays(s?.[a.at] ?? null, now);
            const old = age === null || age >= staleDays;
            return (
              <div key={a.area} id={`up-${a.area}`} className={`card ${old ? "warn" : ""}`}>
                <div className="row between"><div style={{ fontWeight: 600, fontSize: 15 }}>{a.title}</div><span className={old ? "stale" : "sub"} style={{ fontSize: 12 }}>{ageLabel(age)}</span></div>
                <div className="sub" style={{ margin: "6px 0 12px" }}>{a.desc}</div>
                <UploadBox id={`file-${a.area}`} villageId={id} label={AREA_LABEL[a.area].action} />
              </div>
            );
          })}
        </div>
        <div className="sub" style={{ marginTop: 8, fontSize: 12 }}>Desktop- oder Mobile-Screenshot – Art und Layout werden automatisch erkannt. Neue Werte erscheinen hier, sobald Du die Lesung unter Screenshots bestätigt hast (Lernmodus) oder die Erkennung sicher genug ist.</div>
      </section>

      <section id="desc" className="card hi" aria-labelledby="desc-h">
        <div className="row between" style={{ alignItems: "baseline" }}><h2 id="desc-h">KI-Instruktionen für {village.name}</h2><Link href="/#strategie" style={{ fontSize: 13 }}>Account-Instruktionen bearbeiten</Link></div>
        <div style={{ margin: "10px 0", padding: "10px 12px", borderRadius: 8, background: "#191612", fontSize: 13, color: "var(--text2)" }}>
          <span className="sub">Vom Account übernommen:</span> {me?.aiInstructions ? me.aiInstructions : <em className="sub">(noch keine)</em>}
        </div>
        <form action={saveVillageInstructionsAction}>
          <input type="hidden" name="villageId" value={id} />
          <label htmlFor="vdesc" className="sub" style={{ display: "block", marginBottom: 6 }}>Was soll dieses Dorf werden? Ergänzt die Account-Instruktionen für alle Empfehlungen zu diesem Dorf.</label>
          <textarea id="vdesc" name="text" rows={3} className="field" maxLength={4000} defaultValue={instructions} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn">Speichern</button>
            {saved && <span className="sub" role="status">Gespeichert.</span>}
            {error && <span className="errtext" role="alert">{error}</span>}
          </div>
        </form>
      </section>

      <section className="card hi" aria-labelledby="tips">
        <h2 id="tips">Nächste Schritte für {village.name}</h2>
        <div className="sub" style={{ margin: "4px 0 10px" }}>KI-Empfehlung aus Ist-Zustand, Spieldaten sowie Account- und Dorf-Instruktionen</div>
        <p className="sub">Noch keine Empfehlungen – die KI-Auswertung wird mit Phase 2 freigeschaltet.</p>
      </section>

      <div className="grid2">
        <section className="card" aria-labelledby="res">
          <div className="row between" style={{ alignItems: "baseline" }}><h2 id="res">Rohstoffe</h2><span className="sub" style={{ fontSize: 12 }}>{s?.resourcesAt ? `Stand ${s.resourcesAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : ""}</span></div>
          {s?.resources ? (
            <div className="scroll" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>Rohstoff</th><th className="r">Bestand</th><th className="r">Produktion/h</th>{res.productionGross && <th className="r">brutto/h</th>}</tr></thead>
                <tbody>{RES_ROWS.map(([k, label]) => (
                  <tr key={k}><td>{label}</td><td className="mono r">{num(res.stock?.[k])}</td><td className="mono r">{signed(res.production?.[k])}</td>{res.productionGross && <td className="mono r">{num(res.productionGross[k])}</td>}</tr>
                ))}</tbody>
              </table>
              <p className="sub" style={{ fontSize: 12, marginTop: 6 }}>{[res.merchants ? `Händler ${res.merchants}` : null, typeof res.freeCrop === "number" ? `freies Getreide ${fmt(res.freeCrop)}` : null].filter(Boolean).join(" · ")}</p>
            </div>
          ) : <p className="sub" style={{ marginTop: 10 }}>Noch kein Ist-Zustand – lade einen Screenshot der Ressourcenfelder oder der Dorfübersicht hoch.</p>}
          {fields.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="sub" style={{ fontSize: 12, marginBottom: 4 }}>Rohstofffelder (Stufen)</div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{fields.map((f, i) => <span key={i} className="pill p-none mono">{f.level}</span>)}</div>
            </div>
          )}
        </section>
        <section id="trp" className="card" aria-labelledby="trp-h">
          <div className="row between" style={{ alignItems: "baseline" }}><h2 id="trp-h">Truppen</h2><span className={s?.troopsAt && (ageInDays(s.troopsAt, now) ?? 0) >= staleDays ? "stale" : "sub"} style={{ fontSize: 12 }}>{s?.troopsAt ? `Stand ${ageLabel(ageInDays(s.troopsAt, now))}` : "noch nie aktualisiert"}</span></div>
          {troops.length > 0 && (
            <div className="scroll" style={{ marginTop: 8 }}><table><thead><tr><th>Einheit</th><th className="r">Im Dorf</th><th className="r">Unterwegs</th><th className="r">Unterstützung</th></tr></thead>
              <tbody>{troops.map((t) => <tr key={t.unit}><td>{t.unit}</td><td className="mono r">{fmt(t.inVillage)}</td><td className="mono r">{fmt(t.away)}</td><td className="mono r">{fmt(t.support)}</td></tr>)}</tbody></table></div>
          )}
          <form action={saveTroopsAction} style={{ marginTop: 12 }}>
            <input type="hidden" name="villageId" value={id} />
            <label htmlFor="troops-text" className="lbl">Manuell eintragen – eine Einheit je Zeile: Name; im Dorf; unterwegs; Unterstützung</label>
            <textarea id="troops-text" name="text" rows={5} className="field mono" defaultValue={troopsToText(troops)} placeholder={"Axtkämpfer; 3410; 600; 0\nKatapult; 120; 0; 0"} />
            <div className="row" style={{ marginTop: 8 }}><button className="btn sm">Truppen speichern</button></div>
          </form>
          <p className="sub" style={{ marginTop: 8, fontSize: 12 }}>Alternativ zum Screenshot (Versammlungsplatz oder Dorfstatistik › Truppen). <strong>Hinweis:</strong> Admins und Moderatoren können die Truppen deiner Dörfer zur Planung und Koordination einsehen.</p>
        </section>
      </div>

      <section className="card flush" aria-labelledby="bld">
        <div className="row between" style={{ alignItems: "baseline", margin: "12px 12px 8px" }}><h2 id="bld">Gebäude (Ist-Zustand)</h2><span className="sub" style={{ fontSize: 12 }}>Namen, Nutzen und Kosten folgen mit den <Link href="/gamedata">Spieldaten</Link></span></div>
        <div className="scroll">
          <table style={{ minWidth: 720 }}>
            <thead><tr><th>Gebäude</th><th>Stufe</th><th>Nutzen aktuell</th><th>Nächste Stufe kostet</th><th>Nutzen danach</th></tr></thead>
            <tbody>
              {buildings.length === 0 && <tr><td colSpan={5} className="sub">Noch keine Gebäudedaten – lade einen Screenshot der Dorfansicht hoch.</td></tr>}
              {buildings.map((b, i) => <tr key={i}><td>{b.name ?? `Gebäude ${i + 1}`}</td><td className="mono">{b.level}</td><td className="sub">–</td><td className="sub">–</td><td className="sub">–</td></tr>)}
              {queue.map((q, i) => <tr key={`q${i}`}><td>{q.building} <span className="pill p-wait">im Bau</span></td><td className="mono">→ {q.level ?? "?"}</td><td className="sub" colSpan={3}>{[q.remaining ? `noch ${q.remaining}` : null, q.finishAt ? `fertig ${q.finishAt}` : null].filter(Boolean).join(" · ")}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
