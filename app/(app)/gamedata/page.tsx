import Link from "next/link";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = [["buildings", "Gebäude"], ["units", "Truppen"], ["tribes", "Völker"]] as const;

export default async function GameDataPage({ searchParams }: { searchParams: Promise<{ tab?: string; tribe?: string; b?: string }> }) {
  await requirePermission("map.view");
  const sp = await searchParams;
  const tab = TABS.some(([id]) => id === sp.tab) ? (sp.tab as string) : "buildings";
  const version = await db.gameDataVersion.findFirst({ orderBy: { id: "desc" } });
  return (
    <>
      <header className="row between" style={{ alignItems: "flex-end" }}>
        <div><div className="sub">Referenzdaten für KI-Empfehlungen und Dorf-Dashboards</div><h1>Spieldaten</h1></div>
        <div className="sub" style={{ fontSize: 12, textAlign: "right" }}>
          {version ? <>Datenstand: {version.source} · {version.importedAt.toLocaleDateString("de-DE")} · Server-Speed {version.serverSpeed}×</> : "Datenstand: noch kein Import"}
        </div>
      </header>
      <div role="tablist" aria-label="Datenbanken" className="tabs">
        {TABS.map(([id, label]) => <Link key={id} role="tab" aria-selected={id === tab} className={`tab ${id === tab ? "on" : ""}`} href={`/gamedata?tab=${id}`}>{label}</Link>)}
      </div>
      {!version ? (
        <section className="card">
          <p className="sub">Noch keine Spieldaten. Werte werden ausschließlich aus der freigegebenen Quelle importiert (manuell ausgelöst, versioniert) – nie geschätzt. Der Import startet nach Freigabe der Datenquelle.</p>
        </section>
      ) : tab === "buildings" ? <Buildings versionId={version.id} speed={version.serverSpeed} selected={Number(sp.b)} /> : tab === "units" ? <Units versionId={version.id} tribeId={Number(sp.tribe)} /> : <Tribes versionId={version.id} />}
    </>
  );
}

async function Buildings({ versionId, speed, selected }: { versionId: number; speed: number; selected: number }) {
  const list = await db.building.findMany({ where: { versionId }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  const cur = list.find((b) => b.id === selected) ?? list[0];
  const levels = cur ? await db.buildingLevel.findMany({ where: { buildingId: cur.id }, orderBy: { level: "asc" } }) : [];
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
      <section className="card" style={{ flex: "1 1 220px", maxWidth: 260, padding: 10 }}>
        {list.map((b) => <Link key={b.id} href={`/gamedata?tab=buildings&b=${b.id}`} className={`listbtn ${b.id === cur?.id ? "on" : ""}`}><span>{b.name}</span><span className="sub" style={{ fontSize: 11 }}>{b.tribeRestriction ?? "alle"}</span></Link>)}
      </section>
      {cur && (
        <section className="card flush" style={{ flex: "999 1 480px", minWidth: 0 }}>
          <div style={{ margin: 12 }}><h2 style={{ fontSize: 18 }}>{cur.name}</h2><div className="sub">{cur.description}</div></div>
          <div className="scroll"><table style={{ minWidth: 720 }}>
            <thead><tr><th>Stufe</th><th className="r">Holz</th><th className="r">Lehm</th><th className="r">Eisen</th><th className="r">Getreide</th><th className="r">Versorgung</th><th className="r">Bauzeit</th></tr></thead>
            <tbody>{levels.map((l) => <tr key={l.level}><td className="mono">{l.level}</td><td className="mono r">{fmt(l.costWood)}</td><td className="mono r">{fmt(l.costClay)}</td><td className="mono r">{fmt(l.costIron)}</td><td className="mono r">{fmt(l.costCrop)}</td><td className="mono r">{l.upkeep}</td><td className="mono r">{fmtTime(Math.round(l.buildTimeSec / speed))}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}

/** Zeiten werden aus dem Basiswert und der Server-Geschwindigkeit berechnet, nicht je Speed gespeichert. */
function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function Units({ versionId, tribeId }: { versionId: number; tribeId: number }) {
  const tribes = await db.tribe.findMany({ where: { versionId }, orderBy: { name: "asc" } });
  const cur = tribes.find((t) => t.id === tribeId) ?? tribes[0];
  const units = cur ? await db.unit.findMany({ where: { versionId, tribeId: cur.id }, orderBy: { id: "asc" } }) : [];
  return (
    <section className="card flush">
      <div className="row" style={{ margin: 12, gap: 8 }} role="group" aria-label="Volk">
        {tribes.map((t) => <Link key={t.id} href={`/gamedata?tab=units&tribe=${t.id}`} className={`opt ${t.id === cur?.id ? "on" : ""}`}>{t.name}</Link>)}
      </div>
      <div className="scroll"><table style={{ minWidth: 860 }}>
        <thead><tr><th>Einheit</th><th className="r">Angriff</th><th className="r">Def Inf.</th><th className="r">Def Kav.</th><th className="r">Tempo</th><th className="r">Tragen</th><th className="r">Kosten H/L/E/G</th><th className="r">Versorgung</th><th>Gebäude</th></tr></thead>
        <tbody>{units.map((u) => <tr key={u.id}><td style={{ fontWeight: 500 }}>{u.name}</td><td className="mono r">{u.attack}</td><td className="mono r">{u.defInf}</td><td className="mono r">{u.defCav}</td><td className="mono r">{u.speed}</td><td className="mono r">{u.carry}</td><td className="mono r">{u.costWood}/{u.costClay}/{u.costIron}/{u.costCrop}</td><td className="mono r">{u.upkeep}</td><td className="sub">{u.building}</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

async function Tribes({ versionId }: { versionId: number }) {
  const tribes = await db.tribe.findMany({ where: { versionId }, orderBy: { name: "asc" } });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
      {tribes.map((t) => <section key={t.id} className="card"><h2 style={{ fontSize: 17, marginBottom: 6 }}>{t.name}</h2><pre className="sub mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(t.traits, null, 2)}</pre></section>)}
    </div>
  );
}
