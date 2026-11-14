import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { mailEnabled } from "@/lib/mail";
import { requireUser } from "@/lib/session";
import { requestOwnResetAction, setDmMailAction } from "./actions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const { reset } = await searchParams;
  const mail = mailEnabled();
  const dmMail = (await db.user.findUnique({ where: { id: user.id }, select: { dmMail: true } }))?.dmMail ?? false;
  return (
    <>
      <header>
        <div className="sub">{t("privacy.eyebrow")}</div>
        <h1>{t("account.title")}</h1>
      </header>
      <section className="card" aria-labelledby="acc-mail">
        <h2 id="acc-mail">{t("account.email")}</h2>
        <p style={{ marginTop: 6 }}>
          <span className="mono">{user.email}</span>{" "}
          {mail && <span className={`pill ${user.emailVerified ? "p-ok" : "p-wait"}`}>{t(user.emailVerified ? "account.verified" : "account.unverified")}</span>}
        </p>
      </section>
      <section className="card" aria-labelledby="acc-pw">
        <h2 id="acc-pw">{t("account.password")}</h2>
        <p className="sub" style={{ margin: "6px 0 12px" }}>{t("account.passwordIntro")}</p>
        {mail ? (
          <form action={requestOwnResetAction}><button className="btn">{t("account.sendReset")}</button></form>
        ) : (
          <p className="sub">{t("auth.forgot.noMail")}</p>
        )}
        {reset === "sent" && <p className="sub" role="status" style={{ marginTop: 10 }}>{t("account.resetSent", { email: user.email })}</p>}
        {reset === "limit" && <p className="errtext" role="alert" style={{ marginTop: 10 }}>{t("err.tooManyAttempts")}</p>}
      </section>
      <section className="card" aria-labelledby="acc-notify-h" id="acc-notify">
        <h2 id="acc-notify-h">{t("account.notify.title")}</h2>
        {mail ? (
          <form action={setDmMailAction} className="row" style={{ gap: 10, marginTop: 8, alignItems: "center" }}>
            <span>{dmMail ? t("account.notify.on") : t("account.notify.off")}</span>
            {dmMail
              ? <button className="btn ghost sm" name="on" value="0">{t("account.notify.disable")}</button>
              : <button className="btn sm" name="on" value="1">{t("account.notify.enable")}</button>}
          </form>
        ) : <p className="sub" style={{ marginTop: 6 }}>{t("account.notify.noMail")}</p>}
        <p className="sub" style={{ fontSize: 12, marginTop: 6 }}>{t("account.notify.hint")}</p>
        <p style={{ marginTop: 10 }}><Link className="btn ghost sm" href="/app">{t("install.nav")}: {t("notify.title")} →</Link></p>
      </section>
    </>
  );
}
