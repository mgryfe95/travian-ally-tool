import Link from "next/link";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { ageLabel } from "@/lib/reminders";
import { troopsOverview } from "@/lib/services/troops";
import { getStaleDays } from "@/lib/services/villages";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TroopsPage({ searchParams }: { searchParams: Promise<{ stale?: string; q?: string }> }) {
  const user = await requirePermission("troops.view");
  const sp = await searchParams;
  const [o, staleDays] = await Promise.all([troopsOverview(db, user), getStaleDays(db)]);
  const q = sp.q?.trim().toLowerCase();
  const members = o.members.filter((m) => (!q || m.playerName.toLowerCase().includes(q)) && (sp.stale !== "1" || m.oldestAgeDays === null || m.oldestAgeDays >= staleDays));
  const isStale = (age: number | null) => age === null || age >= staleDays;

  return (
    <>
      <header>
        <div className="sub">Planung &amp; Koordination</div>
        <h1>Truppen der Mitglieder</h1>
        <p className="sub" style={{ marginTop: 4 }}>
          Nur für Moderatoren und Admins. Quelle sind die von den Mitgliedern eingetragenen bzw. hochgeladenen Stände; ältere Stände sind markiert. Mitglieder wissen, dass ihre Truppen hier sichtbar sind. Jede Einsicht wird im Audit-Log vermerkt.
        </p>
      </header>

      <section className="card" aria-labelledby="sum">
        <div className="row between" style={{ alignItems: "baseline" }}>
          <h2 id="sum">Gesamt (alle erfassten Mitglieder)</h2>
          <span className="sub" style={{ fontSize: 12 }}>{o.members.length} Mitglieder mit Konto · {o.membersWithoutData} ohne Truppendaten · {o.membersWithoutAccount} ohne Konto</span>
        </div>
        {o.totals.length === 0 ? <p className="sub" style={{ marginTop: 8 }}>Noch keine Truppendaten erfasst. Mitglieder tragen sie im Dorf-Dashboard ein.</p> : (
          <div className="scroll" style={{ marginTop: 8 }}>
            <table style={{ minWidth: 520 }}>
              <thead><tr><th>Einheit</th><th className="r">Im Dorf</th><th className="r">Unterwegs</th><th className="r">Gesamt</th><th className="r">Unterstützung</th></tr></thead>
              <tbody>{o.totals.map((t) => <tr key={t.unit}><td>{t.unit}</td><td className="mono r">{fmt(t.inVillage)}</td><td className="mono r">{fmt(t.away)}</td><td className="mono r" style={{ fontWeight: 600 }}>{fmt(t.total)}</td><td className="mono r sub">{fmt(t.support)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <form className="row" method="get">
        <label className="sr" htmlFor="tq">Mitglied suchen</label>
        <input id="tq" name="q" defaultValue={sp.q} placeholder="Mitglied suchen" className="field" style={{ maxWidth: 240 }} />
        <label className="row" style={{ gap: 6 }}><input type="checkbox" name="stale" value="1" defaultChecked={sp.stale === "1"} /> nur veraltete / fehlende Stände</label>
        <button className="btn ghost sm">Filtern</button>
      </form>

      <section className="card flush" aria-label="Mitglieder">
        <div className="scroll">
          <table style={{ minWidth: 820 }}>
            <thead><tr><th>Mitglied / Dorf</th><th>Koord.</th><th>Truppen (im Dorf / unterwegs)</th><th>Stand</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <MemberRows key={m.playerId} m={m} stale={isStale} />
              ))}
              {members.length === 0 && <tr><td colSpan={4} className="sub">Keine Treffer.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function MemberRows({ m, stale }: { m: Awaited<ReturnType<typeof troopsOverview>>["members"][number]; stale: (a: number | null) => boolean }) {
  return (
    <>
      <tr style={{ background: "rgba(217,164,65,.05)" }}>
        <td colSpan={2}><Link href={`/players/${m.playerId}`} style={{ fontWeight: 600 }}>{m.playerName}</Link> <span className="sub" style={{ fontSize: 12 }}>({m.accounts.join(", ")})</span></td>
        <td className="mono" style={{ fontSize: 13 }}>{m.totals.length ? m.totals.slice(0, 6).map((t) => `${t.unit} ${fmt(t.inVillage)}${t.away ? ` (+${fmt(t.away)})` : ""}`).join(" · ") : <span className="sub">keine Daten</span>}</td>
        <td className={stale(m.oldestAgeDays) ? "stale" : ""}>{ageLabel(m.oldestAgeDays)}</td>
      </tr>
      {m.villages.map((v) => (
        <tr key={v.villageId}>
          <td style={{ paddingLeft: 28 }}>{v.name}</td><td className="mono">({v.x}|{v.y})</td>
          <td className="mono" style={{ fontSize: 13 }}>{v.troops.length ? v.troops.map((t) => `${t.unit} ${fmt(t.inVillage)}${t.away ? ` (+${fmt(t.away)})` : ""}`).join(" · ") : <span className="sub">keine Daten</span>}</td>
          <td className={stale(v.ageDays) ? "stale" : ""}>{ageLabel(v.ageDays)}</td>
        </tr>
      ))}
    </>
  );
}
