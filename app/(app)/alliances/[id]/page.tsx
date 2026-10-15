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

const lbl = (t: T, map: Record<string, MessageKey>, k: string | number) => { const key = map[k]; return key ? t(key) : String(k); };
const STATUS_KEY: Record<string, MessageKey> = { active: "overview.status.active", stagnant: "overview.status.stagnant", inactive: "overview.status.inactive", declining: "overview.status.declining" };
const RELATION_KEY: Record<string, MessageKey> = { OWN: "overview.relation.OWN", ALLIED: "overview.relation.ALLIED", NAP: "overview.relation.NAP", NEUTRAL: "overview.relation.NEUTRAL", ENEMY: "overview.relation.ENEMY" };

export default async function AlliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = await getT();
  await requirePermission("map.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const alliance = await db.alliance.findUnique({ where: { id } });
  if (!alliance) notFound();
  const relation = (await loadRelations(db)).get(id);
  const [members, history] = await Promise.all([
    db.player.findMany({ where: { allianceId: id }, orderBy: { population: "desc" } }),
    db.playerDailyStat.groupBy({ by: ["date"], where: { allianceId: id }, _sum: { population: true }, orderBy: { date: "asc" } }),
  ]);
  return (
    <>
      <header>
        <div className="sub">{t("overview.alliance.label")}{relation ? ` · ${lbl(t, RELATION_KEY, relation)}` : ""}</div>
        <h1>{alliance.name}</h1>
        <div className="sub" style={{ marginTop: 4 }}>{t("overview.alliance.summary", { members: alliance.memberCount, villages: alliance.villageCount, pop: fmt(alliance.population, locale) })}</div>
      </header>
      <section className="card"><h2 style={{ marginBottom: 8 }}>{t("overview.alliance.history")}</h2><Sparkline values={history.map((h) => h._sum.population ?? 0)} /></section>
      <section className="card flush">
        <h2 style={{ margin: "12px 12px 8px" }}>{t("overview.alliance.members")}</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>{t("overview.alliance.colPlayer")}</th><th className="r">{t("overview.alliance.colPop")}</th><th className="r">{t("overview.alliance.colDelta1")}</th><th className="r">{t("overview.alliance.colDelta7")}</th><th>{t("overview.alliance.colStatus")}</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/players/${m.id}`}>{m.name}</Link></td>
                  <td className="mono r">{fmt(m.population, locale)}</td><td className="mono r">{delta(m.delta1, locale)}</td><td className="mono r">{delta(m.delta7, locale)}</td>
                  <td>{lbl(t, STATUS_KEY, m.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
