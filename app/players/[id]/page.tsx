import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/Sparkline";
import { db } from "@/lib/db";
import { delta, fmt, STATUS_LABEL } from "@/lib/format";
import { TRIBES } from "@/lib/inactive";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const player = await db.player.findUnique({ where: { id } });
  if (!player) notFound();
  const [villages, stats, alliance, events] = await Promise.all([
    db.village.findMany({ where: { playerId: id }, orderBy: { population: "desc" } }),
    db.playerDailyStat.findMany({ where: { playerId: id }, orderBy: { date: "asc" } }),
    player.allianceId ? db.alliance.findUnique({ where: { id: player.allianceId } }) : null,
    db.event.findMany({ where: { OR: [{ playerId: id }, { otherPlayerId: id }] }, orderBy: { id: "desc" }, take: 30 }),
  ]);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">{player.name}</h1>
        <p className="text-sm text-zinc-400">
          {TRIBES[player.tribe] ?? player.tribe} · {alliance ? <Link className="hover:text-amber-400" href={`/alliances/${alliance.id}`}>{alliance.name}</Link> : "keine Allianz"} ·{" "}
          {STATUS_LABEL[player.status] ?? player.status} ({player.noGrowthDays} Tage ohne Zuwachs)
        </p>
        <p className="mt-1 text-sm">
          Bevölkerung {fmt(player.population)} · 1 Tag {delta(player.delta1)} · 3 Tage {delta(player.delta3)} · 7 Tage {delta(player.delta7)} · {player.villageCount} Dörfer
        </p>
      </header>
      <section><h2 className="mb-2 font-medium">Verlauf</h2><Sparkline values={stats.map((s) => s.population)} /></section>
      <section>
        <h2 className="mb-2 font-medium">Dörfer</h2>
        <ul className="text-sm">
          {villages.map((v) => (
            <li key={v.id} className="border-t border-zinc-800 py-1">{v.name} ({v.x}|{v.y}) · {fmt(v.population)}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-medium">Ereignisse</h2>
        {events.length === 0 ? <p className="text-sm text-zinc-500">Keine.</p> : (
          <ul className="text-sm">{events.map((e) => <li key={e.id} className="border-t border-zinc-800 py-1">{e.at.toISOString().slice(0, 10)} · {e.type}</li>)}</ul>
        )}
      </section>
    </main>
  );
}
