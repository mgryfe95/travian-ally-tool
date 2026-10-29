import { getT } from "@/lib/i18n/server";
import { mailEnabled } from "@/lib/mail";
import { requireUser } from "@/lib/session";
import { requestOwnResetAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const { reset } = await searchParams;
  const mail = mailEnabled();
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
    </>
  );
}
