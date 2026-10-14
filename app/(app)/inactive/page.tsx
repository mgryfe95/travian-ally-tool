import Link from "next/link";
import { db } from "@/lib/db";
import { loadRelations, ownGroupIds } from "@/lib/alliance-group";
import { roundFields } from "@/lib/geo";
import { loadCandidates, parseCoord, searchInactive, TRIBES } from "@/lib/inactive";
import { delta, fmt } from "@/lib/format";
import { getInactiveDays } from "@/lib/settings";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = Record<string, string | undefined>;
const int = (v?: string) => (v !== undefined && v.trim() !== "" && Number.isInteger(Number(v)) ? Number(v) : undefined);
const MAX_ROWS = 300;

export default async function InactivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission("map.view");
  const sp = await searchParams;
  const inactiveDays = await getInactiveDays(db);

  // Eigene Dörfer = Dörfer der Spieler, mit denen das Konto verifiziert verknüpft ist.
  const links = await db.playerLink.findMany({ where: { userId: user.id, status: "verified" }, select: { travianPlayerId: true } });
  const own = await db.village.findMany({ where: { playerId: { in: links.map((l) => l.travianPlayerId) } }, orderBy: { population: "desc" } });

  // Ursprung: Query > zuletzt gewählt > erstes eigenes Dorf.
  const me = await db.user.findUnique({ where: { id: user.id }, select: { lastOrigin: true } });
  const resolve = (raw?: string) => {
    if (!raw) return undefined;
    if (raw.startsWith("village:")) {
      const v = own.find((x) => x.id === Number(raw.slice(8)));
      return v ? { key: raw, label: v.name, coord: { x: v.x, y: v.y } } : undefined;
    }
    const c = parseCoord(raw.replace(/^coord:/, ""));
    return c ? { key: `${c.x}|${c.y}`, label: `(${c.x}|${c.y})`, coord: c } : undefined;
  };
  const fromQuery = resolve(sp.origin);
  const origin = fromQuery ?? resolve(me?.lastOrigin ?? undefined) ?? (own[0] ? resolve(`village:${own[0].id}`) : undefined);
  if (fromQuery && fromQuery.key !== me?.lastOrigin) await db.user.update({ where: { id: user.id }, data: { lastOrigin: fromQuery.key } });
  const coordInvalid = !!sp.origin && !fromQuery;

  const relations = await loadRelations(db);
  const ownIds = ownGroupIds(relations);
  const allyMode = sp.ally === "none" ? "none" : sp.ally === "all" ? "all" : "others";
  const minDays = int(sp.minDays) ?? inactiveDays;
  const results = origin
    ? searchInactive(await loadCandidates(db), origin.coord, {
        maxDistance: int(sp.maxDistance), maxPop: int(sp.maxPop), minDays, tribe: int(sp.tribe),
        allianceId: allyMode === "none" ? 0 : undefined,
        excludeAllianceIds: allyMode === "others" ? ownIds : undefined,
      })
    : [];
  const snap = await db.snapshot.findFirst({ orderBy: { id: "desc" }, select: { fetchedAt: true } });
  const dayOptions = [...new Set([inactiveDays, 5, 7].filter((d) => d >= inactiveDays))];
  const keep = (extra: Params) => "?" + new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <header>
        <div className="sub">Karte · Stand map.sql {snap ? snap.fetchedAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "– noch kein Import"}</div>
        <h1>Inaktive in deiner Nähe</h1>
      </header>
      <section className="card" aria-labelledby="orig">
        <h2 id="orig" style={{ fontSize: 15, marginBottom: 10 }}>Entfernung messen ab</h2>
        <form method="get">
          <div className="row" role="group" aria-label="Ausgangsdorf">
            {own.map((v) => (
              <Link key={v.id} className={`opt ${origin?.key === `village:${v.id}` ? "on" : ""}`} href={keep({ origin: `village:${v.id}` })}>
                {v.name} <span className="mono" style={{ opacity: 0.75, fontSize: 12 }}>({v.x}|{v.y})</span>
              </Link>
            ))}
            <div className="row" style={{ gap: 6 }}>
              <label htmlFor="cx" className="lbl" style={{ margin: 0 }}>{own.length ? "oder Koordinate" : "Koordinate"}</label>
              <input id="cx" name="origin" className="field mono" placeholder="(x|y)" style={{ width: 120 }} defaultValue={origin?.key.startsWith("village:") ? "" : origin?.label} />
            </div>
          </div>
          {coordInvalid && <p className="errtext" role="alert" style={{ marginTop: 8 }}>Koordinate nicht erkannt – Format (x|y), Bereich −200…200.</p>}
          {own.length === 0 && <p className="sub" style={{ marginTop: 8 }}>Deine eigenen Dörfer erscheinen hier, sobald dein Konto mit einem Travian-Spieler verifiziert ist.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 12, marginTop: 16 }}>
            <div><label className="lbl" htmlFor="fmax">Max. Entfernung</label><input id="fmax" name="maxDistance" className="field mono" inputMode="numeric" defaultValue={sp.maxDistance} /></div>
            <div><label className="lbl" htmlFor="fpop">Einwohner bis</label><input id="fpop" name="maxPop" className="field mono" inputMode="numeric" defaultValue={sp.maxPop} /></div>
            <div>
              <label className="lbl" htmlFor="fdays">Inaktiv seit mind.</label>
              <select id="fdays" name="minDays" className="field" defaultValue={String(minDays)}>{dayOptions.map((d) => <option key={d} value={d}>{d} Tagen</option>)}</select>
            </div>
            <div>
              <label className="lbl" htmlFor="ftribe">Volk</label>
              <select id="ftribe" name="tribe" className="field" defaultValue={sp.tribe ?? ""}>
                <option value="">Alle</option>
                {[1, 2, 3, 6, 7, 8].map((t) => <option key={t} value={t}>{TRIBES[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="fally">Allianz</label>
              <select id="fally" name="ally" className="field" defaultValue={allyMode}>
                <option value="others">Alle außer eigene</option>
                <option value="none">Ohne Allianz</option>
                <option value="all">Alle (inkl. eigene Gruppe)</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn">Suchen</button></div>
        </form>
      </section>
      {origin ? (
        <section className="card flush" aria-labelledby="res">
          <div className="row between" style={{ alignItems: "baseline", margin: "12px 12px 8px" }}>
            <h2 id="res">{results.length} Treffer ab {origin.label}</h2>
            <span className="sub" style={{ fontSize: 12 }}>sortiert nach Entfernung · Kartenrand wird umgerechnet{results.length > MAX_ROWS ? ` · zeige ${MAX_ROWS}` : ""}</span>
          </div>
          <div className="scroll">
            <table style={{ minWidth: 820 }}>
              <thead><tr><th>Entf.</th><th>Dorf</th><th>Koord.</th><th>Spieler</th><th>Allianz</th><th>Volk</th><th className="r">Einw.</th><th className="r">Δ 7 Tage</th><th>Status</th></tr></thead>
              <tbody>
                {results.slice(0, MAX_ROWS).map((r) => {
                  const shrinking = (r.delta7 ?? 0) < 0;
                  return (
                    <tr key={r.villageId}>
                      <td className="mono" style={{ color: "var(--link-h)", fontWeight: 500 }}>{roundFields(r.distance).toFixed(1)}</td>
                      <td>{r.villageName}</td>
                      <td className="mono">({r.x}|{r.y})</td>
                      <td><Link href={`/players/${r.playerId}`}>{r.playerName}</Link></td>
                      <td style={{ color: "var(--text2)" }}>{r.allianceId ? <Link href={`/alliances/${r.allianceId}`}>{r.allianceName}</Link> : "—"}</td>
                      <td style={{ color: "var(--text2)" }}>{TRIBES[r.tribe] ?? r.tribe}</td>
                      <td className="mono r">{fmt(r.playerPop)}</td>
                      <td className="mono r sub">{r.delta7 === null ? "–" : r.delta7 === 0 ? "±0" : delta(r.delta7)}</td>
                      <td><span style={{ fontSize: 12, fontWeight: 600, color: shrinking ? "var(--warn)" : "var(--info)" }}>{shrinking ? "schrumpft" : "inaktiv"} · {r.noGrowthDays} T</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {results.length === 0 && <p className="sub" style={{ margin: 12 }}>Keine Treffer. Inaktive erscheinen, sobald mindestens {inactiveDays} Tagesstände ohne Bevölkerungszuwachs vorliegen.</p>}
        </section>
      ) : (
        !coordInvalid && <section className="card"><p className="sub">Wähle ein eigenes Dorf oder gib eine Koordinate (x|y) ein.</p></section>
      )}
    </>
  );
}
