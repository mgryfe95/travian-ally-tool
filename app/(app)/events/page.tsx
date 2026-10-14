import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  village_new: "neues Dorf", village_lost: "Dorf verloren", village_conquered: "Dorf erobert",
  alliance_change: "Allianzwechsel", player_gone: "Spieler verschwunden",
};

export default async function EventsPage() {
  await requirePermission("map.view");
  const events = await db.event.findMany({ orderBy: { id: "desc" }, take: 200 });
  const ids = [...new Set(events.flatMap((e) => [e.playerId, e.otherPlayerId]).filter((x): x is number => x !== null))];
  const names = new Map((await db.player.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const villages = new Map((await db.village.findMany({ where: { id: { in: events.map((e) => e.villageId).filter((x): x is number => x !== null) } } })).map((v) => [v.id, v]));
  const who = (id: number | null) => (id === null ? null : <Link href={`/players/${id}`}>{names.get(id) ?? `#${id}`}</Link>);
  return (
    <>
      <header><div className="sub">Karte</div><h1>Ereignisse</h1></header>
      <section className="card">
        {events.length === 0 && <p className="sub">Noch keine Ereignisse. Sie entstehen ab dem zweiten Import.</p>}
        <ul>
          {events.map((e) => {
            const v = e.villageId !== null ? villages.get(e.villageId) : undefined;
            return (
              <li key={e.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line2)" }}>
                <span className="sub mono">{e.at.toISOString().slice(0, 10)}</span> · <span className="chip">{LABEL[e.type] ?? e.type}</span> {who(e.playerId)}
                {e.otherPlayerId !== null && <> (von {who(e.otherPlayerId)})</>}
                {v && <> · {v.name} <span className="mono">({v.x}|{v.y})</span></>}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
