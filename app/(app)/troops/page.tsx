import Link from "next/link";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { Locale, T } from "@/lib/i18n";
import { troopsOverview } from "@/lib/services/troops";
import { getStaleDays } from "@/lib/services/villages";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

/** `ageLabel` aus lib/reminders mit Übersetzung (lib/reminders.ts enthält noch deutsche Texte). */
const ageText = (t: T, age: number | null) => (age === null ? t("overview.age.never") : age <= 0 ? t("overview.age.today") : age === 1 ? t("overview.age.yesterday") : t("overview.age.daysAgo", { n: age }));

export default async function TroopsPage({ searchParams }: { searchParams: Promise<{ stale?: string; q?: string }> }) {
  const { t, locale } = await getT();
  const user = await requirePermission("troops.view");
  const sp = await searchParams;
  const [o, staleDays] = await Promise.all([troopsOverview(db, user), getStaleDays(db)]);
  const q = sp.q?.trim().toLowerCase();
  const members = o.members.filter((m) => (!q || m.playerName.toLowerCase().includes(q)) && (sp.stale !== "1" || m.oldestAgeDays === null || m.oldestAgeDays >= staleDays));
  const isStale = (age: number | null) => age === null || age >= staleDays;

  return (
    <>
      <header>
        <div className="sub">{t("overview.troops.section")}</div>
        <h1>{t("overview.troops.title")}</h1>
        <p className="sub" style={{ marginTop: 4 }}>
          {t("overview.troops.intro")}
        </p>
      </header>

      <section className="card" aria-labelledby="sum">
        <div className="row between" style={{ alignItems: "baseline" }}>
          <h2 id="sum">{t("overview.troops.total")}</h2>
          <span className="sub" style={{ fontSize: 12 }}>{t("overview.troops.counts", { members: o.members.length, noData: o.membersWithoutData, noAccount: o.membersWithoutAccount })}</span>
        </div>
        {o.totals.length === 0 ? <p className="sub" style={{ marginTop: 8 }}>{t("overview.troops.noData")}</p> : (
          <div className="scroll" style={{ marginTop: 8 }}>
            <table style={{ minWidth: 520 }}>
              <thead><tr><th>{t("overview.troops.colUnit")}</th><th className="r">{t("overview.troops.colHome")}</th><th className="r">{t("overview.troops.colAway")}</th><th className="r">{t("overview.troops.colTotal")}</th><th className="r">{t("overview.troops.colSupport")}</th></tr></thead>
              <tbody>{o.totals.map((u) => <tr key={u.unit}><td>{u.unit}</td><td className="mono r">{fmt(u.inVillage, locale)}</td><td className="mono r">{fmt(u.away, locale)}</td><td className="mono r" style={{ fontWeight: 600 }}>{fmt(u.total, locale)}</td><td className="mono r sub">{fmt(u.support, locale)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <form className="row" method="get">
        <label className="sr" htmlFor="tq">{t("overview.troops.search")}</label>
        <input id="tq" name="q" defaultValue={sp.q} placeholder={t("overview.troops.search")} className="field" style={{ maxWidth: 240 }} />
        <label className="row" style={{ gap: 6 }}><input type="checkbox" name="stale" value="1" defaultChecked={sp.stale === "1"} /> {t("overview.troops.staleOnly")}</label>
        <button className="btn ghost sm">{t("overview.troops.filter")}</button>
      </form>

      <section className="card flush" aria-label={t("overview.troops.members")}>
        <div className="scroll">
          <table style={{ minWidth: 820 }}>
            <thead><tr><th>{t("overview.troops.colMember")}</th><th>{t("overview.troops.colCoord")}</th><th>{t("overview.troops.colTroops")}</th><th>{t("overview.troops.colAge")}</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <MemberRows key={m.playerId} m={m} stale={isStale} t={t} locale={locale} />
              ))}
              {members.length === 0 && <tr><td colSpan={4} className="sub">{t("overview.troops.noResults")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function MemberRows({ m, stale, t, locale }: { m: Awaited<ReturnType<typeof troopsOverview>>["members"][number]; stale: (a: number | null) => boolean; t: T; locale: Locale }) {
  return (
    <>
      <tr style={{ background: "rgba(217,164,65,.05)" }}>
        <td colSpan={2}><Link href={`/players/${m.playerId}`} style={{ fontWeight: 600 }}>{m.playerName}</Link> <span className="sub" style={{ fontSize: 12 }}>({m.accounts.join(", ")})</span></td>
        <td className="mono" style={{ fontSize: 13 }}>{m.totals.length ? m.totals.slice(0, 6).map((u) => `${u.unit} ${fmt(u.inVillage, locale)}${u.away ? ` (+${fmt(u.away, locale)})` : ""}`).join(" · ") : <span className="sub">{t("overview.troops.noDataShort")}</span>}</td>
        <td className={stale(m.oldestAgeDays) ? "stale" : ""}>{ageText(t, m.oldestAgeDays)}</td>
      </tr>
      {m.villages.map((v) => (
        <tr key={v.villageId}>
          <td style={{ paddingLeft: 28 }}>{v.name}</td><td className="mono">({v.x}|{v.y})</td>
          <td className="mono" style={{ fontSize: 13 }}>{v.troops.length ? v.troops.map((u) => `${u.unit} ${fmt(u.inVillage, locale)}${u.away ? ` (+${fmt(u.away, locale)})` : ""}`).join(" · ") : <span className="sub">{t("overview.troops.noDataShort")}</span>}</td>
          <td className={stale(v.ageDays) ? "stale" : ""}>{ageText(t, v.ageDays)}</td>
        </tr>
      ))}
    </>
  );
}
