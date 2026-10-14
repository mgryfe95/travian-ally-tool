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
  const villages = new Map(
    (await db.village.findMany({ where: { id: { in: events.map((e) => e.villageId).filter((x): x is number => x !== null) } } })).map((v) => [v.id, v]),
  );
  const who = (id: number | null) => (id === null ? null : <Link className="hover:text-amber-400" href={`/players/${id}`}>{names.get(id) ?? `#${id}`}</Link>);
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Ereignisse</h1>
      {events.length === 0 && <p className="mt-4 text-zinc-500">Noch keine Ereignisse. Sie entstehen ab dem zweiten Import.</p>}
      <ul className="mt-4 text-sm">
        {events.map((e) => {
          const v = e.villageId !== null ? villages.get(e.villageId) : undefined;
          return (
            <li key={e.id} className="border-t border-zinc-800 py-1.5">
              <span className="text-zinc-500">{e.at.toISOString().slice(0, 10)}</span> · {LABEL[e.type] ?? e.type} · {who(e.playerId)}
              {e.otherPlayerId !== null && <> (von {who(e.otherPlayerId)})</>}
              {v && <> · {v.name} ({v.x}|{v.y})</>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
