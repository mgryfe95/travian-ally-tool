import { CoordLink } from "@/components/CoordLink";
import Link from "next/link";
import { db } from "@/lib/db";
import { loadRelations, ownGroupIds } from "@/lib/alliance-group";
import { roundFields } from "@/lib/geo";
import { loadCandidates, parseCoord, searchInactive } from "@/lib/inactive";
import { delta, fmt, fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey, T } from "@/lib/i18n";
import { getInactiveDays } from "@/lib/settings";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = Record<string, string | undefined>;
const int = (v?: string) => (v !== undefined && v.trim() !== "" && Number.isInteger(Number(v)) ? Number(v) : undefined);
const MAX_ROWS = 300;
const lbl = (t: T, map: Record<string, MessageKey>, k: string | number) => { const key = map[k]; return key ? t(key) : String(k); };
const TRIBE_KEY: Record<number, MessageKey> = { 1: "overview.tribe.1", 2: "overview.tribe.2", 3: "overview.tribe.3", 4: "overview.tribe.4", 5: "overview.tribe.5", 6: "overview.tribe.6", 7: "overview.tribe.7", 8: "overview.tribe.8" };

export default async function InactivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const { t, locale } = await getT();
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
        <div className="sub">{t("overview.inactive.snapshot", { date: snap ? fmtDate(snap.fetchedAt, locale) : t("overview.inactive.noImport") })}</div>
        <h1>{t("overview.inactive.title")}</h1>
      </header>
      <section className="card" aria-labelledby="orig">
        <h2 id="orig" style={{ fontSize: 15, marginBottom: 10 }}>{t("overview.inactive.measureFrom")}</h2>
        <form method="get">
          <div className="row" role="group" aria-label={t("overview.inactive.originGroup")}>
            {own.map((v) => (
              <Link key={v.id} className={`opt ${origin?.key === `village:${v.id}` ? "on" : ""}`} href={keep({ origin: `village:${v.id}` })}>
                {v.name} <span className="mono" style={{ opacity: 0.75, fontSize: 12 }}><CoordLink x={v.x} y={v.y} /></span>
              </Link>
            ))}
            <div className="row" style={{ gap: 6 }}>
              <label htmlFor="cx" className="lbl" style={{ margin: 0 }}>{own.length ? t("overview.inactive.orCoord") : t("overview.inactive.coord")}</label>
              <input id="cx" name="origin" className="field mono" placeholder="(x|y)" style={{ width: 120 }} defaultValue={origin?.key.startsWith("village:") ? "" : origin?.label} />
            </div>
          </div>
          {coordInvalid && <p className="errtext" role="alert" style={{ marginTop: 8 }}>{t("overview.inactive.coordInvalid")}</p>}
          {own.length === 0 && <p className="sub" style={{ marginTop: 8 }}>{t("overview.inactive.noOwn")}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 12, marginTop: 16 }}>
            <div><label className="lbl" htmlFor="fmax">{t("overview.inactive.maxDistance")}</label><input id="fmax" name="maxDistance" className="field mono" inputMode="numeric" defaultValue={sp.maxDistance} /></div>
            <div><label className="lbl" htmlFor="fpop">{t("overview.inactive.maxPop")}</label><input id="fpop" name="maxPop" className="field mono" inputMode="numeric" defaultValue={sp.maxPop} /></div>
            <div>
              <label className="lbl" htmlFor="fdays">{t("overview.inactive.minDays")}</label>
              <select id="fdays" name="minDays" className="field" defaultValue={String(minDays)}>{dayOptions.map((d) => <option key={d} value={d}>{t("overview.inactive.daysOption", { n: d })}</option>)}</select>
            </div>
            <div>
              <label className="lbl" htmlFor="ftribe">{t("overview.inactive.tribe")}</label>
              <select id="ftribe" name="tribe" className="field" defaultValue={sp.tribe ?? ""}>
                <option value="">{t("overview.inactive.tribeAll")}</option>
                {[1, 2, 3, 6, 7, 8].map((tr) => <option key={tr} value={tr}>{lbl(t, TRIBE_KEY, tr)}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="fally">{t("overview.inactive.alliance")}</label>
              <select id="fally" name="ally" className="field" defaultValue={allyMode}>
                <option value="others">{t("overview.inactive.allyOthers")}</option>
                <option value="none">{t("overview.inactive.allyNone")}</option>
                <option value="all">{t("overview.inactive.allyAll")}</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn">{t("overview.inactive.search")}</button></div>
        </form>
      </section>
      {origin ? (
        <section className="card flush" aria-labelledby="res">
          <div className="row between" style={{ alignItems: "baseline", margin: "12px 12px 8px" }}>
            <h2 id="res">{t("overview.inactive.hits", { n: results.length, origin: origin.label })}</h2>
            <span className="sub" style={{ fontSize: 12 }}>{t("overview.inactive.sortNote")}{results.length > MAX_ROWS ? t("overview.inactive.showing", { n: MAX_ROWS }) : ""}</span>
          </div>
          <div className="scroll">
            <table style={{ minWidth: 820 }}>
              <thead><tr><th>{t("overview.inactive.colDistance")}</th><th>{t("overview.inactive.colVillage")}</th><th>{t("overview.inactive.colCoord")}</th><th>{t("overview.inactive.colPlayer")}</th><th>{t("overview.inactive.colAlliance")}</th><th>{t("overview.inactive.colTribe")}</th><th className="r">{t("overview.inactive.colPop")}</th><th className="r">{t("overview.inactive.colDelta7")}</th><th>{t("overview.inactive.colStatus")}</th></tr></thead>
              <tbody>
                {results.slice(0, MAX_ROWS).map((r) => {
                  const shrinking = (r.delta7 ?? 0) < 0;
                  return (
                    <tr key={r.villageId}>
                      <td className="mono" style={{ color: "var(--link-h)", fontWeight: 500 }}>{roundFields(r.distance).toFixed(1)}</td>
                      <td>{r.villageName}</td>
                      <td className="mono"><CoordLink x={r.x} y={r.y} /></td>
                      <td><Link href={`/players/${r.playerId}`}>{r.playerName}</Link></td>
                      <td style={{ color: "var(--text2)" }}>{r.allianceId ? <Link href={`/alliances/${r.allianceId}`}>{r.allianceName}</Link> : "—"}</td>
                      <td style={{ color: "var(--text2)" }}>{lbl(t, TRIBE_KEY, r.tribe)}</td>
                      <td className="mono r">{fmt(r.playerPop, locale)}</td>
                      <td className="mono r sub">{r.delta7 === null ? "–" : r.delta7 === 0 ? "±0" : delta(r.delta7, locale)}</td>
                      <td><span style={{ fontSize: 12, fontWeight: 600, color: shrinking ? "var(--warn)" : "var(--info)" }}>{t("overview.inactive.statusDays", { status: t(shrinking ? "overview.inactive.shrinking" : "overview.inactive.inactive"), n: r.noGrowthDays })}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {results.length === 0 && <p className="sub" style={{ margin: 12 }}>{t("overview.inactive.noHits", { n: inactiveDays })}</p>}
        </section>
      ) : (
        !coordInvalid && <section className="card"><p className="sub">{t("overview.inactive.pickOrigin")}</p></section>
      )}
    </>
  );
}
