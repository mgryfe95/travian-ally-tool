import Link from "next/link";
import { InstallButton } from "@/components/InstallButton";
import { apkInfo } from "@/lib/app-apk";
import { env } from "@/lib/env";
import { fmtDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** App-Installation: Web-App (empfohlen, Android + iOS) und APK als Alternative. Nur angemeldet. */
export default async function InstallPage() {
  await requireUser();
  const { t, locale } = await getT();
  const apk = await apkInfo();
  const url = env().APP_URL.replace(/^https?:\/\//, "");
  const steps = (keys: string[]) => <ol style={{ paddingLeft: 20, margin: "8px 0 0", display: "grid", gap: 4 }}>{keys.map((k) => <li key={k}>{t(k as MessageKey, { url })}</li>)}</ol>;
  return (
    <>
      <header>
        <div className="sub">{t("install.eyebrow")}</div>
        <h1>{t("install.title")}</h1>
        <p className="sub">{t("install.intro")}</p>
      </header>
      <InstallButton />
      <section className="card soft" aria-labelledby="ins-trust">
        <h2 id="ins-trust">{t("install.trust.title")}</h2>
        <ul style={{ paddingLeft: 20, margin: "8px 0 0", display: "grid", gap: 4 }}>
          {["install.trust.1", "install.trust.2", "install.trust.3", "install.trust.4"].map((k) => <li key={k}>{t(k as MessageKey)}</li>)}
        </ul>
      </section>
      <div className="row" style={{ gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
        <section className="card" aria-labelledby="ins-android" style={{ flex: "1 1 300px" }}>
          <h2 id="ins-android">{t("install.android.title")}</h2>
          {steps(["install.android.1", "install.android.2", "install.android.3"])}
        </section>
        <section className="card" aria-labelledby="ins-ios" style={{ flex: "1 1 300px" }}>
          <h2 id="ins-ios">{t("install.ios.title")}</h2>
          {steps(["install.ios.1", "install.ios.2", "install.ios.3"])}
        </section>
      </div>
      <p className="card hi">{t("install.push")} <Link href="/account/notifications">{t("install.toNotify")} →</Link></p>
      <section className="card" aria-labelledby="ins-apk" id="apk">
        <h2 id="ins-apk">{t("install.apk.title")}</h2>
        <p className="sub" style={{ margin: "6px 0 0" }}>{t("install.apk.text")}</p>
        {steps(["install.apk.1", "install.apk.2", "install.apk.3"])}
        <p style={{ marginTop: 12 }}>
          {apk ? <a className="btn ghost" href="/app/download" download>{t("install.apk.download", { size: (apk.size / 1048576).toFixed(1), date: fmtDate(apk.updatedAt, locale, { dateStyle: "short" }) })}</a> : <span className="sub">{t("install.apk.missing")}</span>}
        </p>
      </section>
    </>
  );
}
