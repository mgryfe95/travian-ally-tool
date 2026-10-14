import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/Sparkline";
import { db } from "@/lib/db";
import { loadRelations, RELATION_LABEL } from "@/lib/alliance-group";
import { delta, fmt, STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AlliancePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const alliance = await db.alliance.findUnique({ where: { id } });
  if (!alliance) notFound();
  const relation = (await loadRelations(db)).get(id);
  const [members, history] = await Promise.all([
    db.player.findMany({ where: { allianceId: id }, orderBy: { population: "desc" } }),
    db.playerDailyStat.groupBy({ by: ["date"], where: { allianceId: id }, _sum: { population: true }, orderBy: { date: "asc" } }),
  ]);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">{alliance.name}</h1>
        <p className="text-sm text-zinc-400">{relation ? `${RELATION_LABEL[relation]} · ` : ""}{alliance.memberCount} Mitglieder · {alliance.villageCount} Dörfer · Bevölkerung {fmt(alliance.population)}</p>
      </header>
      <section><h2 className="mb-2 font-medium">Verlauf (Summe Bevölkerung)</h2><Sparkline values={history.map((h) => h._sum.population ?? 0)} /></section>
      <section>
        <h2 className="mb-2 font-medium">Mitglieder</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400"><tr><th>Spieler</th><th className="text-right">Bev.</th><th className="text-right">Δ1</th><th className="text-right">Δ7</th><th>Status</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-zinc-800">
                <td className="py-1"><Link className="hover:text-amber-400" href={`/players/${m.id}`}>{m.name}</Link></td>
                <td className="text-right tabular-nums">{fmt(m.population)}</td>
                <td className="text-right tabular-nums">{delta(m.delta1)}</td>
                <td className="text-right tabular-nums">{delta(m.delta7)}</td>
                <td>{STATUS_LABEL[m.status] ?? m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
