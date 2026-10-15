import Link from "next/link";
import { db } from "@/lib/db";
import { fmt, fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { Locale, MessageKey, T } from "@/lib/i18n";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = [["buildings", "overview.gamedata.tabBuildings"], ["units", "overview.gamedata.tabUnits"], ["tribes", "overview.gamedata.tabTribes"]] as const satisfies readonly (readonly [string, MessageKey])[];

export default async function GameDataPage({ searchParams }: { searchParams: Promise<{ tab?: string; tribe?: string; b?: string }> }) {
  const { t, locale } = await getT();
  await requirePermission("map.view");
  const sp = await searchParams;
  const tab = TABS.some(([id]) => id === sp.tab) ? (sp.tab as string) : "buildings";
  const version = await db.gameDataVersion.findFirst({ orderBy: { id: "desc" } });
  return (
    <>
      <header className="row between" style={{ alignItems: "flex-end" }}>
        <div><div className="sub">{t("overview.gamedata.subtitle")}</div><h1>{t("overview.gamedata.title")}</h1></div>
        <div className="sub" style={{ fontSize: 12, textAlign: "right" }}>
          {version ? t("overview.gamedata.version", { source: version.source, date: fmtDate(version.importedAt, locale, { dateStyle: "short" }), speed: version.serverSpeed }) : t("overview.gamedata.noVersion")}
        </div>
      </header>
      <div role="tablist" aria-label={t("overview.gamedata.tabsLabel")} className="tabs">
        {TABS.map(([id, label]) => <Link key={id} role="tab" aria-selected={id === tab} className={`tab ${id === tab ? "on" : ""}`} href={`/gamedata?tab=${id}`}>{t(label)}</Link>)}
      </div>
      {!version ? (
        <section className="card">
          <p className="sub">{t("overview.gamedata.empty")}</p>
        </section>
      ) : tab === "buildings" ? <Buildings versionId={version.id} speed={version.serverSpeed} selected={Number(sp.b)} t={t} locale={locale} /> : tab === "units" ? <Units versionId={version.id} tribeId={Number(sp.tribe)} t={t} /> : <Tribes versionId={version.id} />}
    </>
  );
}

async function Buildings({ versionId, speed, selected, t, locale }: { versionId: number; speed: number; selected: number; t: T; locale: Locale }) {
  const list = await db.building.findMany({ where: { versionId }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  const cur = list.find((b) => b.id === selected) ?? list[0];
  const levels = cur ? await db.buildingLevel.findMany({ where: { buildingId: cur.id }, orderBy: { level: "asc" } }) : [];
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
      <section className="card" style={{ flex: "1 1 220px", maxWidth: 260, padding: 10 }}>
        {list.map((b) => <Link key={b.id} href={`/gamedata?tab=buildings&b=${b.id}`} className={`listbtn ${b.id === cur?.id ? "on" : ""}`}><span>{b.name}</span><span className="sub" style={{ fontSize: 11 }}>{b.tribeRestriction ?? t("overview.gamedata.allTribes")}</span></Link>)}
      </section>
      {cur && (
        <section className="card flush" style={{ flex: "999 1 480px", minWidth: 0 }}>
          <div style={{ margin: 12 }}><h2 style={{ fontSize: 18 }}>{cur.name}</h2><div className="sub">{cur.description}</div></div>
          <div className="scroll"><table style={{ minWidth: 720 }}>
            <thead><tr><th>{t("overview.gamedata.colLevel")}</th><th className="r">{t("overview.gamedata.colWood")}</th><th className="r">{t("overview.gamedata.colClay")}</th><th className="r">{t("overview.gamedata.colIron")}</th><th className="r">{t("overview.gamedata.colCrop")}</th><th className="r">{t("overview.gamedata.colUpkeep")}</th><th className="r">{t("overview.gamedata.colBuildTime")}</th></tr></thead>
            <tbody>{levels.map((l) => <tr key={l.level}><td className="mono">{l.level}</td><td className="mono r">{fmt(l.costWood, locale)}</td><td className="mono r">{fmt(l.costClay, locale)}</td><td className="mono r">{fmt(l.costIron, locale)}</td><td className="mono r">{fmt(l.costCrop, locale)}</td><td className="mono r">{l.upkeep}</td><td className="mono r">{fmtTime(Math.round(l.buildTimeSec / speed))}</td></tr>)}</tbody>
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

async function Units({ versionId, tribeId, t }: { versionId: number; tribeId: number; t: T }) {
  const tribes = await db.tribe.findMany({ where: { versionId }, orderBy: { name: "asc" } });
  const cur = tribes.find((t) => t.id === tribeId) ?? tribes[0];
  const units = cur ? await db.unit.findMany({ where: { versionId, tribeId: cur.id }, orderBy: { id: "asc" } }) : [];
  return (
    <section className="card flush">
      <div className="row" style={{ margin: 12, gap: 8 }} role="group" aria-label={t("overview.gamedata.tribeGroup")}>
        {tribes.map((tr) => <Link key={tr.id} href={`/gamedata?tab=units&tribe=${tr.id}`} className={`opt ${tr.id === cur?.id ? "on" : ""}`}>{tr.name}</Link>)}
      </div>
      <div className="scroll"><table style={{ minWidth: 860 }}>
        <thead><tr><th>{t("overview.gamedata.colUnit")}</th><th className="r">{t("overview.gamedata.colAttack")}</th><th className="r">{t("overview.gamedata.colDefInf")}</th><th className="r">{t("overview.gamedata.colDefCav")}</th><th className="r">{t("overview.gamedata.colSpeed")}</th><th className="r">{t("overview.gamedata.colCarry")}</th><th className="r">{t("overview.gamedata.colCost")}</th><th className="r">{t("overview.gamedata.colUpkeep")}</th><th>{t("overview.gamedata.colBuilding")}</th></tr></thead>
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
