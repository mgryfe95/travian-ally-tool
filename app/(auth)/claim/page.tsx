import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loadGroupPlayers } from "@/lib/alliance-group";
import { nextHourlyRun } from "@/lib/cron-label";
import { env } from "@/lib/env";
import { INTL_TAG } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { startClaimAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const { error } = await searchParams;
  const links = await db.playerLink.findMany({ where: { userId: user.id }, orderBy: { id: "desc" } });
  if (links.some((l) => l.status === "verified")) redirect("/");
  const pending = links.find((l) => l.status === "pending");
  const player = pending ? await db.player.findUnique({ where: { id: pending.travianPlayerId } }) : null;
  const group = await loadGroupPlayers(db);
  const next = nextHourlyRun(env().IMPORT_CRON);
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("auth.claim.title")}</h1>
      <p className="sub" style={{ margin: "0 0 16px" }}>{t("auth.claim.intro")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <form action={startClaimAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label className="lbl" htmlFor="cp">{t("auth.claim.playerName")}</label>
            <input id="cp" name="playerName" className="field" list="group-players" required defaultValue={player?.name ?? ""} autoComplete="off" />
            <datalist id="group-players">{group.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          </div>
          {error && <p className="errtext" role="alert">{error}</p>}
          <button className="btn ghost">{pending ? t("auth.claim.newCode") : t("auth.claim.code")}</button>
        </form>
        {pending?.claimCode && (
          <>
            <div className="card" style={{ background: "#191612" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("auth.claim.howTo")}</div>
              <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, color: "var(--text2)" }}>
                <li>{t("auth.claim.step1")} <span className="mono" style={{ color: "var(--link-h)", fontSize: 16 }}>{pending.claimCode}</span></li>
                <li>{next ? t("auth.claim.step2Next", { time: next.toLocaleTimeString(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit" }) }) : t("auth.claim.step2")}</li>
                <li>{t("auth.claim.step3")}</li>
              </ol>
            </div>
            <div className="row"><span className="pill p-wait">{t("auth.claim.waiting")}</span></div>
          </>
        )}
        <div className="sub" style={{ fontSize: 13 }}>{t("auth.claim.manual")}</div>
        <Link className="btn ghost" href="/">{t("auth.claim.guest")}</Link>
      </div>
    </>
  );
}
