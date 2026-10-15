import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { CALL_KINDS, KIND_LABEL, PLACEHOLDERS, renderCall, type CallKind } from "@/lib/services/schedule";
import { requirePermission } from "@/lib/session";
import { cancelCallAction, createCallAction, deleteCallAction, deleteTemplateAction, saveTemplateAction, sendCallAction } from "../admin/actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { scheduled: "geplant", draft: "auf Abruf", sent: "gesendet", cancelled: "abgebrochen", sending: "wird gesendet" };
const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(d) : "–");

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
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
        <div className="sub">Koordination</div>
        <h1>Allianz-Schedule</h1>
        <p className="sub" style={{ marginTop: 4 }}>Calls für Angriffe, Deff-Unterstützung und Angriffstage. Geplante Calls werden zur Zeit automatisch in den Kanal gepostet (Zeiten in MEZ/MESZ), Calls ohne Zeit nur auf Knopfdruck.</p>
      </header>
      {error && <p className="errtext" role="alert">{error}</p>}

      {manage && (
        <section className="card" aria-labelledby="new">
          <h2 id="new">Neuer Call</h2>
          <form action={createCallAction} className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
            <div><label className="lbl" htmlFor="kind">Art</label>
              <select id="kind" name="kind" className="field" style={{ width: "auto" }}>{CALL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></div>
            <div><label className="lbl" htmlFor="coord">Koordinaten</label>
              <input id="coord" name="coord" className="field" placeholder="-3|-82" style={{ width: 120 }} /></div>
            <div><label className="lbl" htmlFor="at">Zeit (leer = auf Abruf)</label>
              <input id="at" name="at" type="datetime-local" className="field" style={{ width: "auto" }} /></div>
            <div><label className="lbl" htmlFor="chn">Kanal</label>
              <select id="chn" name="channelId" className="field" style={{ width: "auto" }}><option value="">laut Vorlage</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div style={{ flex: "1 1 180px" }}><label className="lbl" htmlFor="title">Titel (optional)</label>
              <input id="title" name="title" className="field" maxLength={80} /></div>
            <div style={{ flex: "1 1 220px" }}><label className="lbl" htmlFor="note">Notiz (optional)</label>
              <input id="note" name="note" className="field" maxLength={500} /></div>
            <button className="btn">Anlegen</button>
            <button className="btn ghost" name="sendNow" value="1">Anlegen &amp; sofort senden</button>
          </form>
          <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>Spieler, Dorf und Link zur Spielerseite werden aus den Koordinaten (letzte map.sql) ermittelt.</p>
        </section>
      )}

      <section className="card flush" aria-labelledby="open">
        <h2 id="open" style={{ margin: "12px 12px 8px" }}>Anstehend ({open.length})</h2>
        {open.length === 0 ? <p className="sub" style={{ margin: "0 12px 12px" }}>Keine anstehenden Calls.</p> : (
          <div className="scroll"><table style={{ minWidth: 760 }}>
            <thead><tr><th>Zeit</th><th>Art</th><th>Ziel</th><th>Kanal</th><th>Status</th><th>Vorschau</th><th /></tr></thead>
            <tbody>{open.map((c) => (
              <tr key={c.id}>
                <td>{when(c.at)}</td><td>{KIND_LABEL[c.kind as CallKind] ?? c.kind}</td>
                <td>{c.playerName ? <>{c.playerName} <span className="mono sub">({c.x}|{c.y})</span></> : c.title || "–"}</td>
                <td>{chName.get(c.channelId) ?? "?"}</td><td><span className="pill p-wait">{STATUS[c.status] ?? c.status}</span></td>
                <td className="sub" style={{ maxWidth: 280, whiteSpace: "pre-wrap", fontSize: 12 }}>{renderCall(c)}</td>
                <td className="r">{manage && (
                  <span className="row" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
                    <form action={sendCallAction}><input type="hidden" name="callId" value={c.id} /><button className="btn sm">Jetzt senden</button></form>
                    <form action={cancelCallAction}><input type="hidden" name="callId" value={c.id} /><button className="btn ghost sm">Abbrechen</button></form>
                  </span>)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      {done.length > 0 && (
        <section className="card flush" aria-labelledby="done">
          <h2 id="done" style={{ margin: "12px 12px 8px" }}>Zuletzt</h2>
          <div className="scroll"><table style={{ minWidth: 560 }}>
            <tbody>{done.map((c) => (
              <tr key={c.id}><td>{when(c.sentAt ?? c.at)}</td><td>{KIND_LABEL[c.kind as CallKind] ?? c.kind}</td><td>{c.playerName ?? c.title ?? "–"}</td><td>{chName.get(c.channelId) ?? "?"}</td><td>{STATUS[c.status]}</td>
                <td className="r">{manage && <form action={deleteCallAction}><input type="hidden" name="callId" value={c.id} /><button className="btn ghost sm">Löschen</button></form>}</td></tr>))}</tbody>
          </table></div>
        </section>
      )}

      {manage && (
        <section className="card" aria-labelledby="tpl">
          <h2 id="tpl">Vorlagen</h2>
          <p className="sub" style={{ fontSize: 12, margin: "4px 0 10px" }}>Platzhalter: {PLACEHOLDERS.join(" ")} – Zeilen mit leerem Platzhalter fallen weg. Markdown und Koordinaten (x|y) werden im Chat wie üblich dargestellt.</p>
          {templates.map((t) => (
            <form key={t.id} action={saveTemplateAction} style={{ borderTop: "1px solid var(--line2)", padding: "10px 0" }}>
              <input type="hidden" name="templateId" value={t.id} />
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                <input name="name" defaultValue={t.name} className="field" aria-label="Vorlagenname" style={{ minHeight: 36, flex: "1 1 160px" }} />
                <select name="kind" defaultValue={t.kind} className="field" style={{ width: "auto", minHeight: 36 }} aria-label="Art">{CALL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                <select name="channelId" defaultValue={t.channelId ?? ""} className="field" style={{ width: "auto", minHeight: 36 }} aria-label="Standard-Kanal"><option value="">erster Kanal</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <textarea name="body" defaultValue={t.body} rows={4} className="field" aria-label="Vorlagentext" style={{ width: "100%", marginTop: 8, fontFamily: "inherit" }} />
              <div className="row" style={{ marginTop: 6 }}><button className="btn ghost sm">Speichern</button><button formAction={deleteTemplateAction} className="btn ghost sm">Löschen</button></div>
            </form>
          ))}
          <form action={saveTemplateAction} style={{ borderTop: "1px solid var(--line2)", padding: "10px 0 0" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <input name="name" required minLength={2} className="field" placeholder="Neue Vorlage" aria-label="Neue Vorlage" style={{ minHeight: 36, flex: "1 1 160px" }} />
              <select name="kind" className="field" style={{ width: "auto", minHeight: 36 }} aria-label="Art neue Vorlage">{CALL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
            </div>
            <textarea name="body" required rows={3} className="field" aria-label="Text neue Vorlage" placeholder="⚔️ {art} auf {spieler} {koordinaten} – {zeit} {link}" style={{ width: "100%", marginTop: 8, fontFamily: "inherit" }} />
            <button className="btn ghost sm" style={{ marginTop: 6 }}>Vorlage anlegen</button>
          </form>
        </section>
      )}
    </>
  );
}
