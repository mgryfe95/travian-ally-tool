import { db } from "@/lib/db";
import { isOwnGroup, loadRelations, RELATION_LABEL, RELATIONS } from "@/lib/alliance-group";
import { fmt } from "@/lib/format";
import { requirePermission } from "@/lib/session";
import { classifyAllianceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AllianceAdmin({ searchParams }: { searchParams: Promise<{ error?: string; q?: string }> }) {
  await requirePermission("alliances.classify");
  const { error, q } = await searchParams;
  const [alliances, relations, notes] = await Promise.all([
    db.alliance.findMany({ where: q ? { name: { contains: q, mode: "insensitive" } } : undefined, orderBy: { population: "desc" }, take: 300 }),
    loadRelations(db),
    db.allianceClassification.findMany(),
  ]);
  const noteOf = new Map(notes.map((n) => [n.allianceId, n.note ?? ""]));
  const sorted = [...alliances].sort((a, b) => Number(relations.has(b.id)) - Number(relations.has(a.id)));
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold">Allianzen & Allianz-Gruppe</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Allianzen vom Typ <b>Eigene Allianz</b> oder <b>Allianz</b> bilden zusammen die eigene Gruppe und zählen überall (Einladungen, Abgleich, Filter) als eine Allianz.
      </p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <form className="mt-3 text-sm"><input name="q" defaultValue={q} placeholder="Allianz suchen" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1" /></form>
      <table className="mt-4 w-full text-left text-sm">
        <thead className="text-zinc-400"><tr><th>Allianz</th><th className="text-right">Mitgl.</th><th className="text-right">Bev.</th><th>Typ</th><th>Notiz</th><th></th></tr></thead>
        <tbody>
          {sorted.map((a) => {
            const rel = relations.get(a.id);
            return (
              <tr key={a.id} className={`border-t border-zinc-800 ${isOwnGroup(rel) ? "bg-amber-500/5" : ""}`}>
                <td className="py-1">{a.name} <span className="text-xs text-zinc-500">#{a.id}</span></td>
                <td className="text-right tabular-nums">{a.memberCount}</td>
                <td className="text-right tabular-nums">{fmt(a.population)}</td>
                <td colSpan={3}>
                  <form action={classifyAllianceAction} className="flex items-center gap-2">
                    <input type="hidden" name="allianceId" value={a.id} />
                    <select name="relation" defaultValue={rel ?? "CLEAR"} className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">
                      <option value="CLEAR">– keine –</option>
                      {RELATIONS.map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
                    </select>
                    <input name="note" defaultValue={noteOf.get(a.id)} placeholder="Notiz" className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
                    <button className="rounded border border-zinc-700 px-2 py-0.5 hover:border-amber-400">Speichern</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
