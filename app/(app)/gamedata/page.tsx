import Link from "next/link";
import { db } from "@/lib/db";
import { fmt, fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { Locale, MessageKey, T } from "@/lib/i18n";
import { EFFECTS, EFFECT_IDS, effectLabelKey, effectValue, formatDelta, formatEffect, presentEffects, rowsToEffects } from "@/lib/gamedata/effects";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = [["buildings", "overview.gamedata.tabBuildings"], ["effects", "overview.gamedata.tabEffects"], ["units", "overview.gamedata.tabUnits"], ["tribes", "overview.gamedata.tabTribes"]] as const satisfies readonly (readonly [string, MessageKey])[];

export default async function GameDataPage({ searchParams }: { searchParams: Promise<{ tab?: string; tribe?: string; b?: string; fx?: string }> }) {
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
          {version ? t("overview.gamedata.version", { source: shortSource(version.source), date: fmtDate(version.importedAt, locale, { dateStyle: "short" }), speed: version.serverSpeed }) : t("overview.gamedata.noVersion")}
        </div>
      </header>
      <div role="tablist" aria-label={t("overview.gamedata.tabsLabel")} className="tabs">
        {TABS.map(([id, label]) => <Link key={id} role="tab" aria-selected={id === tab} className={`tab ${id === tab ? "on" : ""}`} href={`/gamedata?tab=${id}`}>{t(label)}</Link>)}
      </div>
      {!version ? (
        <section className="card">
          <p className="sub">{t("overview.gamedata.empty")}</p>
        </section>
      ) : tab === "buildings" ? <Buildings versionId={version.id} speed={version.serverSpeed} selected={Number(sp.b)} fx={sp.fx} t={t} locale={locale} /> : tab === "effects" ? <EffectsCompare versionId={version.id} fx={sp.fx} selected={Number(sp.b)} t={t} locale={locale} /> : tab === "units" ? <Units versionId={version.id} tribeId={Number(sp.tribe)} t={t} /> : <Tribes versionId={version.id} t={t} />}
    </>
  );
}

const HL = { background: "rgba(214, 170, 90, 0.12)" } as const;

/** Quelle kurz: nur Host der URL (Prüfsumme/Abrufdatum stehen im Datenstand-Datum). */
function shortSource(src: string) {
  const m = /https?:\/\/([^/\s]+)/.exec(src);
  return m ? m[1]! : src.split(" (")[0]!;
}

function Cell({ id, prev, cur, locale, hl }: { id: string; prev: number | null; cur: number | null; locale: Locale; hl?: boolean }) {
  const d = formatDelta(id, prev, cur, locale, "ui");
  return <td className="mono r" style={hl ? HL : undefined}>{formatEffect(id, cur, locale)}{d && <div className="sub" style={{ fontSize: 11 }}>Δ {d}</div>}</td>;
}

async function Buildings({ versionId, speed, selected, fx, t, locale }: { versionId: number; speed: number; selected: number; fx?: string; t: T; locale: Locale }) {
  const list = await db.building.findMany({ where: { versionId }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  const cur = list.find((b) => b.id === selected) ?? list[0];
  const rows = cur ? await db.buildingLevel.findMany({ where: { buildingId: cur.id }, orderBy: { level: "asc" }, include: { effectRows: true } }) : [];
  const levels = rows.map((l) => ({ ...l, effects: rowsToEffects(l.effectRows) }));
  const ids = presentEffects(levels);
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
      <section className="card" style={{ flex: "1 1 220px", maxWidth: 260, padding: 10 }}>
        {list.map((b) => <Link key={b.id} href={`/gamedata?tab=buildings&b=${b.id}${fx ? `&fx=${fx}` : ""}`} className={`listbtn ${b.id === cur?.id ? "on" : ""}`}><span>{b.name}</span><span className="sub" style={{ fontSize: 11 }}>{b.tribeRestriction ?? t("overview.gamedata.allTribes")}</span></Link>)}
      </section>
      {cur && (
        <section className="card flush" style={{ flex: "999 1 480px", minWidth: 0 }}>
          <div style={{ margin: 12 }}><h2 style={{ fontSize: 18 }}>{cur.name}</h2><div className="sub" style={{ fontSize: 12 }}>{t("overview.gamedata.legend")}</div></div>
          <div className="scroll"><table style={{ minWidth: 720 }}>
            <thead><tr><th>{t("overview.gamedata.colLevel")}</th><th className="r">{t("overview.gamedata.colWood")}</th><th className="r">{t("overview.gamedata.colClay")}</th><th className="r">{t("overview.gamedata.colIron")}</th><th className="r">{t("overview.gamedata.colCrop")}</th><th className="r">{t("overview.gamedata.colUpkeep")}</th><th className="r">{t("overview.gamedata.colBuildTime")}</th>{ids.map((id) => <th key={id} className="r" style={id === fx ? HL : undefined}><Link href={`/gamedata?tab=effects&fx=${id}&b=${cur.id}`} title={t("overview.gamedata.compareLink")}>{t(effectLabelKey(id) as MessageKey)} ↗</Link></th>)}</tr></thead>
            <tbody>{levels.map((l, i) => <tr key={l.level}><td className="mono">{l.level}</td><td className="mono r">{fmt(l.costWood, locale)}</td><td className="mono r">{fmt(l.costClay, locale)}</td><td className="mono r">{fmt(l.costIron, locale)}</td><td className="mono r">{fmt(l.costCrop, locale)}</td><td className="mono r">{l.upkeep}</td><td className="mono r">{fmtTime(Math.round(l.buildTimeSec / speed))}</td>{ids.map((id) => <Cell key={id} id={id} prev={i > 0 ? effectValue(levels[i - 1]!.effects, id) : null} cur={effectValue(l.effects, id)} locale={locale} hl={id === fx} />)}</tr>)}</tbody>
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

/** Ein Vorteil über alle Gebäude, die ihn liefern: gleiche Einheit, Stufe für Stufe nebeneinander. */
async function EffectsCompare({ versionId, fx, selected, t, locale }: { versionId: number; fx?: string; selected: number; t: T; locale: Locale }) {
  const inVersion = { buildingLevel: { building: { versionId } } };
  const present = new Set((await db.buildingLevelEffect.groupBy({ by: ["effect"], where: inVersion })).map((r) => r.effect));
  const available = [...EFFECT_IDS.filter((i) => present.has(i)), ...[...present].filter((i) => !(i in EFFECTS)).sort()];
  const id = fx && available.includes(fx) ? fx : available[0];
  const rows = id ? await db.buildingLevelEffect.findMany({ where: { ...inVersion, effect: id }, include: { buildingLevel: { include: { building: true } } }, orderBy: [{ buildingId: "asc" }, { level: "asc" }] }) : [];
  const cols = [...new Map(rows.map((r) => [r.buildingId, r.buildingLevel.building])).values()];
  const byKey = new Map(rows.map((r) => [`${r.buildingId}:${r.level}`, r.value]));
  const maxLevel = Math.max(0, ...rows.map((r) => r.level));
  const groups = [...new Set(available.map((i) => EFFECTS[i]?.group ?? "info"))];
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
      <section className="card" style={{ flex: "1 1 240px", maxWidth: 280, padding: 10 }}>
        <p className="sub" style={{ fontSize: 12, margin: "0 4px 8px" }}>{t("overview.gamedata.effectsHint")}</p>
        {groups.map((g) => (
          <div key={g}>
            <div className="sub" style={{ fontSize: 11, margin: "8px 4px 2px", textTransform: "uppercase" }}>{t(`overview.fxGroup.${g}` as MessageKey)}</div>
            {available.filter((i) => (EFFECTS[i]?.group ?? "info") === g).map((i) => <Link key={i} href={`/gamedata?tab=effects&fx=${i}`} className={`listbtn ${i === id ? "on" : ""}`}><span>{t(effectLabelKey(i) as MessageKey)}</span></Link>)}
          </div>
        ))}
      </section>
      {id && (
        <section className="card flush" style={{ flex: "999 1 480px", minWidth: 0 }}>
          <div style={{ margin: 12 }}><h2 style={{ fontSize: 18 }}>{t(effectLabelKey(id) as MessageKey)}</h2><div className="sub" style={{ fontSize: 12 }}>{t("overview.gamedata.legend")}</div></div>
          <div className="scroll"><table style={{ minWidth: 480 }}>
            <thead><tr><th>{t("overview.gamedata.colLevel")}</th>{cols.map((b) => <th key={b.id} className="r" style={b.id === selected ? HL : undefined}><Link href={`/gamedata?tab=buildings&b=${b.id}&fx=${id}`} title={t("overview.gamedata.buildingLink")}>{b.name} ↗</Link></th>)}</tr></thead>
            <tbody>{Array.from({ length: maxLevel }, (_, i) => i + 1).map((lv) => (
              <tr key={lv}><td className="mono">{lv}</td>{cols.map((b) => {
                const cur = byKey.get(`${b.id}:${lv}`) ?? null;
                return <Cell key={b.id} id={id} prev={byKey.get(`${b.id}:${lv - 1}`) ?? null} cur={cur} locale={locale} hl={b.id === selected} />;
              })}</tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}

/** Völker aus der Wissensdatenbank; Einheitennamen hängen über die Volk-ID (`traits.vid` = map.sql-Volk). */
async function tribesWithNames(versionId: number) {
  const tribes = await db.tribe.findMany({ where: { versionId }, orderBy: { name: "asc" } });
  const names = await db.unitName.findMany({ orderBy: [{ tribeVid: "asc" }, { slot: "asc" }] });
  return tribes.map((tr) => {
    const vid = (tr.traits as { vid?: number; en?: string } | null)?.vid ?? null;
    return { tr, vid, en: (tr.traits as { en?: string } | null)?.en ?? "", names: vid === null ? [] : names.filter((n) => n.tribeVid === vid) };
  });
}

async function Units({ versionId, tribeId, t }: { versionId: number; tribeId: number; t: T }) {
  const all = (await tribesWithNames(versionId)).filter((x) => x.names.length > 0);
  const cur = all.find((x) => x.tr.id === tribeId) ?? all[0];
  const stats = cur ? await db.unit.findMany({ where: { versionId, tribeId: cur.tr.id }, orderBy: { id: "asc" } }) : [];
  if (!cur) return <section className="card"><p className="sub">{t("overview.gamedata.unitsEmpty")}</p></section>;
  return (
    <section className="card flush">
      <div className="row" style={{ margin: 12, gap: 8 }} role="group" aria-label={t("overview.gamedata.tribeGroup")}>
        {all.map((x) => <Link key={x.tr.id} href={`/gamedata?tab=units&tribe=${x.tr.id}`} className={`opt ${x.tr.id === cur.tr.id ? "on" : ""}`}>{x.tr.name}</Link>)}
      </div>
      <div className="scroll"><table style={{ minWidth: 480 }}>
        <thead><tr><th>{t("overview.gamedata.unitSlot")}</th><th>{t("overview.gamedata.unitNameDe")}</th><th>{t("overview.gamedata.unitNameEn")}</th></tr></thead>
        <tbody>{cur.names.map((n) => <tr key={n.slot}><td className="mono">{n.slot}</td><td style={{ fontWeight: 500 }}>{n.nameDe ?? n.nameEn}</td><td className="sub">{n.nameEn}</td></tr>)}</tbody>
      </table></div>
      {stats.length > 0 && (
        <div className="scroll"><table style={{ minWidth: 860 }}>
          <thead><tr><th>{t("overview.gamedata.colUnit")}</th><th className="r">{t("overview.gamedata.colAttack")}</th><th className="r">{t("overview.gamedata.colDefInf")}</th><th className="r">{t("overview.gamedata.colDefCav")}</th><th className="r">{t("overview.gamedata.colSpeed")}</th><th className="r">{t("overview.gamedata.colCarry")}</th><th className="r">{t("overview.gamedata.colCost")}</th><th className="r">{t("overview.gamedata.colUpkeep")}</th><th>{t("overview.gamedata.colBuilding")}</th></tr></thead>
          <tbody>{stats.map((u) => <tr key={u.id}><td style={{ fontWeight: 500 }}>{u.name}</td><td className="mono r">{u.attack}</td><td className="mono r">{u.defInf}</td><td className="mono r">{u.defCav}</td><td className="mono r">{u.speed}</td><td className="mono r">{u.carry}</td><td className="mono r">{u.costWood}/{u.costClay}/{u.costIron}/{u.costCrop}</td><td className="mono r">{u.upkeep}</td><td className="sub">{u.building}</td></tr>)}</tbody>
        </table></div>
      )}
      <p className="sub" style={{ margin: 12, fontSize: 12 }}>{t("overview.gamedata.unitsNote")}</p>
    </section>
  );
}

async function Tribes({ versionId, t }: { versionId: number; t: T }) {
  const all = await tribesWithNames(versionId);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
      {all.map(({ tr, en, names }) => (
        <section key={tr.id} className="card">
          <h2 style={{ fontSize: 17, marginBottom: 2 }}>{tr.name}</h2>
          {en && en !== tr.name && <div className="sub" style={{ fontSize: 12 }}>{t("overview.gamedata.tribeEnglish", { name: en })}</div>}
          {names.length > 0 && <ol className="sub" style={{ margin: "8px 0 0", paddingLeft: 20 }}>{names.map((n) => <li key={n.slot} value={n.slot}>{n.nameDe ?? n.nameEn}</li>)}</ol>}
        </section>
      ))}
    </div>
  );
}
