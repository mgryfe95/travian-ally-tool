import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/Sparkline";
import { db } from "@/lib/db";
import { loadRelations, RELATION_LABEL } from "@/lib/alliance-group";
import { delta, fmt, STATUS_LABEL } from "@/lib/format";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AlliancePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("map.view");
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
    <>
      <header>
        <div className="sub">Allianz{relation ? ` · ${RELATION_LABEL[relation]}` : ""}</div>
        <h1>{alliance.name}</h1>
        <div className="sub" style={{ marginTop: 4 }}>{alliance.memberCount} Mitglieder · {alliance.villageCount} Dörfer · Einwohner {fmt(alliance.population)}</div>
      </header>
      <section className="card"><h2 style={{ marginBottom: 8 }}>Verlauf (Summe Einwohner)</h2><Sparkline values={history.map((h) => h._sum.population ?? 0)} /></section>
      <section className="card flush">
        <h2 style={{ margin: "12px 12px 8px" }}>Mitglieder</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Spieler</th><th className="r">Einw.</th><th className="r">Δ 1 T</th><th className="r">Δ 7 T</th><th>Status</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/players/${m.id}`}>{m.name}</Link></td>
                  <td className="mono r">{fmt(m.population)}</td><td className="mono r">{delta(m.delta1)}</td><td className="mono r">{delta(m.delta7)}</td>
                  <td>{STATUS_LABEL[m.status] ?? m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
