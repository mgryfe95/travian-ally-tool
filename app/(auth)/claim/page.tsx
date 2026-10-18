import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loadRegistrablePlayers } from "@/lib/alliance-group";
import { nextRelease, renameDeadline } from "@/lib/map-release";
import { env } from "@/lib/env";
import { INTL_TAG, type MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { LogoutButton } from "@/components/AuthForms";
import { fmtDate } from "@/lib/format";
import { mailEnabled } from "@/lib/mail";
import { proveLinkAction, resendVerifyAction, startClaimAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ error?: string; r?: string; mail?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const { error, r, mail } = await searchParams;
  if (user.role !== "UNVERIFIED") redirect("/");
  const lastMap = await db.snapshot.findFirst({ orderBy: { id: "desc" }, select: { fetchedAt: true } });
  const links = await db.playerLink.findMany({ where: { userId: user.id }, orderBy: { id: "desc" } });
  // Verknüpft, aber Rolle noch GUEST (z. B. von einem Moderator zurückgestuft): kein Redirect nach "/" – das Layout schickt GUEST sofort hierher zurück (Schleife).
  const mailPending = mailEnabled() && !user.emailVerified;
  const linked = links.some((l) => l.status === "verified");
  const linkedButLocked = linked && !mailPending;
  const pending = links.find((l) => l.status === "pending");
  const player = pending ? await db.player.findUnique({ where: { id: pending.travianPlayerId } }) : null;
  const group = await loadRegistrablePlayers(db);
  const cfg = env();
  const deadline = renameDeadline(cfg.MAP_RELEASE_TIME);
  const release = nextRelease(new Date(), cfg.GAME_TIMEZONE, cfg.MAP_RELEASE_TIME);
  const clock = (d: Date) => new Intl.DateTimeFormat(INTL_TAG[locale], { timeZone: cfg.GAME_TIMEZONE, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(d);
  return (
    <>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t("auth.claim.title")}</h1>
      <p className="sub" style={{ margin: "0 0 16px" }}>{t("auth.claim.intro")}</p>
      {mailPending && (
        <section className="card warn" role="status" style={{ margin: "0 0 16px" }}>
          <b>{t("auth.claim.mailTitle")}</b>
          <p className="sub" style={{ margin: "6px 0 10px" }}>{t("auth.claim.mailBody", { email: user.email })}</p>
          <form action={resendVerifyAction}><button className="btn ghost sm">{t("auth.claim.mailResend")}</button></form>
          {mail === "sent" && <p className="sub" style={{ marginTop: 8 }}>{t("auth.claim.mailSent")}</p>}
          {mail === "limit" && <p className="errtext" style={{ marginTop: 8 }}>{t("err.tooManyAttempts")}</p>}
        </section>
      )}
      {linkedButLocked && <p className="card warn" role="status" style={{ margin: "0 0 16px" }}>{t("auth.claim.linkedLocked")}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!(linked && mailPending) && (<>
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
            <div className="card" style={{ background: "var(--soft)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("auth.claim.howTo")}</div>
              <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, color: "var(--text2)" }}>
                <li>{t("auth.claim.step1", { deadline, tz: cfg.GAME_TIMEZONE })} <span className="mono" style={{ color: "var(--link-h)", fontSize: 16 }}>{pending.claimCode}</span></li>
                <li>{t("auth.claim.step2", { release: clock(release), time: cfg.MAP_RELEASE_TIME })}</li>
                <li>{t("auth.claim.step3", { time: cfg.MAP_RELEASE_TIME })}</li>
              </ol>
            </div>
            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <form action={proveLinkAction}><button className="btn">{t("auth.claim.prove")}</button></form>
              <span className="pill p-wait">{t("auth.claim.waiting")}</span>
            </div>
            {r && ["unchanged", "not_found", "throttled", "error", "no_claim"].includes(r) && <p className="sub" role="status">{t(`auth.claim.res.${r}` as MessageKey)}</p>}
            {lastMap && <p className="sub" style={{ fontSize: 12, margin: 0 }}>{t("auth.claim.mapState", { time: fmtDate(lastMap.fetchedAt, locale) })}</p>}
          </>
        )}
        </>)}
        <div className="sub" style={{ fontSize: 13 }}>{t("auth.claim.manual")}</div>
        <div><LogoutButton /></div>
      </div>
    </>
  );
}
