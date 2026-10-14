import Link from "next/link";
import { db } from "@/lib/db";
import { roundFields } from "@/lib/geo";
import { loadCandidates, searchInactive, TRIBES, type SortKey } from "@/lib/inactive";
import { fmt } from "@/lib/format";
import { getAllianceId, getInactiveDays } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Params = Record<string, string | undefined>;
const int = (v?: string) => (v !== undefined && v.trim() !== "" && Number.isInteger(Number(v)) ? Number(v) : undefined);
const SORTS: SortKey[] = ["distance", "population", "days"];
const MAX_ROWS = 300;

export default async function InactivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const ox = int(sp.ox);
  const oy = int(sp.oy);
  const origin = ox !== undefined && oy !== undefined ? { x: ox, y: oy } : undefined;
  const sort = SORTS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "distance";
  const [inactiveDays, ownAlliance] = await Promise.all([getInactiveDays(db), getAllianceId(db)]);

  const results = origin
    ? searchInactive(await loadCandidates(db), origin, {
        maxDistance: int(sp.maxDistance), minPop: int(sp.minPop), maxPop: int(sp.maxPop), minDays: int(sp.minDays),
        allianceId: int(sp.alliance), tribe: int(sp.tribe), sort,
      })
    : [];

  const input = "rounded border border-zinc-700 bg-zinc-900 px-2 py-1 w-24";
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-xl font-semibold">Inaktiven-Suche</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Inaktiv = seit mindestens {inactiveDays} Tagen kein Bevölkerungszuwachs.
        {ownAlliance ? ` Eigene Allianz-ID: ${ownAlliance}.` : ""} Der Ursprung aus „Meine Dörfer“ folgt mit dem Login (M3); bis dahin freie Koordinate.
      </p>
      <form className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        {([
          ["ox", "Ursprung x"], ["oy", "Ursprung y"], ["maxDistance", "max. Felder"], ["minPop", "Bev. min"], ["maxPop", "Bev. max"],
          ["minDays", "Tage inaktiv ≥"], ["alliance", "Allianz-ID"],
        ] as const).map(([name, label]) => (
          <label key={name} className="flex flex-col gap-1">
            {label}
            <input name={name} defaultValue={sp[name]} inputMode="numeric" className={input} />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          Volk
          <select name="tribe" defaultValue={sp.tribe ?? ""} className={input}>
            <option value="">alle</option>
            {[1, 2, 3, 6, 7, 8].map((t) => (
              <option key={t} value={t}>{TRIBES[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Sortierung
          <select name="sort" defaultValue={sort} className={input}>
            <option value="distance">Entfernung</option>
            <option value="population">Bevölkerung</option>
            <option value="days">Tage inaktiv</option>
          </select>
        </label>
        <button className="rounded bg-amber-500 px-4 py-1.5 font-medium text-zinc-950">Suchen</button>
      </form>

      {!origin ? (
        <p className="mt-6 text-zinc-400">Koordinate des Ursprungs eingeben (z. B. 0 / 0).</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-zinc-400">{results.length} Treffer{results.length > MAX_ROWS ? ` (zeige ${MAX_ROWS})` : ""}</p>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="py-1">Felder</th><th>Dorf</th><th>Koord.</th><th>Spieler</th><th>Allianz</th><th>Volk</th>
                <th className="text-right">Bev.</th><th className="text-right">Tage</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, MAX_ROWS).map((r) => (
                <tr key={r.villageId} className="border-t border-zinc-800">
                  <td className="py-1 tabular-nums">{roundFields(r.distance).toFixed(1)}</td>
                  <td>{r.villageName}</td>
                  <td className="tabular-nums">({r.x}|{r.y})</td>
                  <td><Link className="hover:text-amber-400" href={`/players/${r.playerId}`}>{r.playerName}</Link></td>
                  <td>{r.allianceId ? <Link className="hover:text-amber-400" href={`/alliances/${r.allianceId}`}>{r.allianceName}</Link> : "–"}</td>
                  <td>{TRIBES[r.tribe] ?? r.tribe}</td>
                  <td className="text-right tabular-nums">{fmt(r.playerPop)}</td>
                  <td className="text-right tabular-nums">{r.noGrowthDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
