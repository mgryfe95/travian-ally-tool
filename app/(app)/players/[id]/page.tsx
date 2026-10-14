import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/Sparkline";
import { db } from "@/lib/db";
import { loadRelations, RELATION_LABEL } from "@/lib/alliance-group";
import { delta, fmt, STATUS_LABEL } from "@/lib/format";
import { TRIBES } from "@/lib/inactive";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("map.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const player = await db.player.findUnique({ where: { id } });
  if (!player) notFound();
  const [villages, stats, alliance, events, relations] = await Promise.all([
    db.village.findMany({ where: { playerId: id }, orderBy: { population: "desc" } }),
    db.playerDailyStat.findMany({ where: { playerId: id }, orderBy: { date: "asc" } }),
    player.allianceId ? db.alliance.findUnique({ where: { id: player.allianceId } }) : null,
    db.event.findMany({ where: { OR: [{ playerId: id }, { otherPlayerId: id }] }, orderBy: { id: "desc" }, take: 30 }),
    loadRelations(db),
  ]);
  const rel = relations.get(player.allianceId);
  return (
    <>
      <header>
        <div className="sub">Spieler</div>
        <h1>{player.name}</h1>
        <div className="sub" style={{ marginTop: 4 }}>
          {TRIBES[player.tribe] ?? player.tribe} · {alliance ? <Link href={`/alliances/${alliance.id}`}>{alliance.name}</Link> : "keine Allianz"}{rel ? ` (${RELATION_LABEL[rel]})` : ""} ·{" "}
          {STATUS_LABEL[player.status] ?? player.status} ({player.noGrowthDays} Tage ohne Zuwachs)
        </div>
      </header>
      <section className="card">
        <p>Einwohner <b className="mono">{fmt(player.population)}</b> · 1 Tag <span className="mono">{delta(player.delta1)}</span> · 3 Tage <span className="mono">{delta(player.delta3)}</span> · 7 Tage <span className="mono">{delta(player.delta7)}</span> · {player.villageCount} Dörfer</p>
        <h2 style={{ margin: "16px 0 8px" }}>Verlauf</h2>
        <Sparkline values={stats.map((s) => s.population)} />
      </section>
      <section className="card flush">
        <h2 style={{ margin: "12px 12px 8px" }}>Dörfer</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Dorf</th><th>Koord.</th><th className="r">Einw.</th></tr></thead>
            <tbody>{villages.map((v) => <tr key={v.id}><td>{v.name}</td><td className="mono">({v.x}|{v.y})</td><td className="mono r">{fmt(v.population)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 8 }}>Ereignisse</h2>
        {events.length === 0 ? <p className="sub">Keine.</p> : <ul>{events.map((e) => <li key={e.id} style={{ padding: "4px 0" }}><span className="sub mono">{e.at.toISOString().slice(0, 10)}</span> · {e.type}</li>)}</ul>}
      </section>
    </>
  );
}
