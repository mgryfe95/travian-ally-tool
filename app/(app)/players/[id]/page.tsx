import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@/components/Sparkline";
import { db } from "@/lib/db";
import { loadRelations } from "@/lib/alliance-group";
import { delta, fmt } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey, T } from "@/lib/i18n";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

const TRIBE_KEY: Record<number, MessageKey> = { 1: "overview.tribe.1", 2: "overview.tribe.2", 3: "overview.tribe.3", 4: "overview.tribe.4", 5: "overview.tribe.5", 6: "overview.tribe.6", 7: "overview.tribe.7", 8: "overview.tribe.8" };
const lbl = (t: T, map: Record<string, MessageKey>, k: string | number) => { const key = map[k]; return key ? t(key) : String(k); };
const STATUS_KEY: Record<string, MessageKey> = { active: "overview.status.active", stagnant: "overview.status.stagnant", inactive: "overview.status.inactive", declining: "overview.status.declining" };
const RELATION_KEY: Record<string, MessageKey> = { OWN: "overview.relation.OWN", ALLIED: "overview.relation.ALLIED", NAP: "overview.relation.NAP", NEUTRAL: "overview.relation.NEUTRAL", ENEMY: "overview.relation.ENEMY" };

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = await getT();
  await requirePermission("map.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const player = await db.player.findUnique({ where: { id } });
  if (!player) notFound();
  const [villages, stats, alliance, events, relations] = await Promise.all([
    db.village.findMany({ where: { playerId: id }, orderBy: { population: "desc" } }),
    db.playerDailyStat.findMany({ where: { playerId: id }, orderBy: { date: "asc" } }),
    player.allianceId ? db.alliance.findUnique({ where: { id: player.allianceId } }) : null,
    db.event.findMany({ where: { OR: [{ playerId: id }, { otherPlayerId: id }] }, orderBy: { id: "desc" }, take: 30 }),
    loadRelations(db),
  ]);
  const rel = relations.get(player.allianceId);
  return (
    <>
      <header>
        <div className="sub">{t("overview.player.label")}</div>
        <h1>{player.name}</h1>
        <div className="sub" style={{ marginTop: 4 }}>
          {lbl(t, TRIBE_KEY, player.tribe)} · {alliance ? <Link href={`/alliances/${alliance.id}`}>{alliance.name}</Link> : t("overview.player.noAlliance")}{rel ? ` (${lbl(t, RELATION_KEY, rel)})` : ""} ·{" "}
          {lbl(t, STATUS_KEY, player.status)} {t("overview.player.noGrowth", { n: player.noGrowthDays })}
        </div>
      </header>
      <section className="card">
        <p>{t("overview.player.population")} <b className="mono">{fmt(player.population, locale)}</b> · {t("overview.player.day1")} <span className="mono">{delta(player.delta1, locale)}</span> · {t("overview.player.day3")} <span className="mono">{delta(player.delta3, locale)}</span> · {t("overview.player.day7")} <span className="mono">{delta(player.delta7, locale)}</span> · {t("overview.player.villageCount", { n: player.villageCount })}</p>
        <h2 style={{ margin: "16px 0 8px" }}>{t("overview.player.history")}</h2>
        <Sparkline values={stats.map((s) => s.population)} />
      </section>
      <section className="card flush">
        <h2 style={{ margin: "12px 12px 8px" }}>{t("overview.player.villages")}</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>{t("overview.player.colVillage")}</th><th>{t("overview.player.colCoord")}</th><th className="r">{t("overview.player.colPop")}</th></tr></thead>
            <tbody>{villages.map((v) => <tr key={v.id}><td>{v.name}</td><td className="mono">({v.x}|{v.y})</td><td className="mono r">{fmt(v.population, locale)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 8 }}>{t("overview.player.events")}</h2>
        {events.length === 0 ? <p className="sub">{t("overview.player.noEvents")}</p> : <ul>{events.map((e) => <li key={e.id} style={{ padding: "4px 0" }}><span className="sub mono">{e.at.toISOString().slice(0, 10)}</span> · {e.type}</li>)}</ul>}
      </section>
    </>
  );
}
