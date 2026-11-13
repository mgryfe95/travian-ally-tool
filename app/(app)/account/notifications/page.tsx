import Link from "next/link";
import { PushDevice } from "@/components/PushDevice";
import { apkInfo } from "@/lib/app-apk";
import { db } from "@/lib/db";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { getNotifySettings, type PrefRow } from "@/lib/services/notify";
import { requireUser } from "@/lib/session";
import { saveNotifyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const { saved } = await searchParams;
  const s = await getNotifySettings(db, user);
  const apk = await apkInfo();
  const list = (rows: PrefRow[], label: (r: PrefRow) => string) =>
    rows.length === 0 ? <p className="sub">{t("notify.none")}</p> : (
      <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "grid", gap: 6 }}>
        {rows.map((r) => (
          <li key={r.key}>
            <input type="hidden" name="keys" value={r.key} />
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="on" value={r.key} defaultChecked={r.on} /> {label(r)}
            </label>
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <header>
        <div className="sub"><Link href="/account">{t("account.title")}</Link></div>
        <h1>{t("notify.title")}</h1>
        <p className="sub">{t("notify.intro")}</p>
      </header>
      <section className="card" aria-labelledby="nf-dev">
        <h2 id="nf-dev">{t("notify.device")}</h2>
        <div style={{ marginTop: 8 }}><PushDevice /></div>
        <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>{t("notify.devices", { n: s.devices })}</p>
      </section>
      <form action={saveNotifyAction} className="card" aria-labelledby="nf-gen">
        <h2 id="nf-gen">{t("notify.general")}</h2>
        {list(s.general, (r) => t(`notify.key.${r.key}` as MessageKey))}
        <h2 style={{ marginTop: 16 }}>{t("notify.channels")}</h2>
        {list(s.channels, (r) => `#${r.label}`)}
        <h2 style={{ marginTop: 16 }}>{t("notify.taskforces")}</h2>
        {list(s.taskforces, (r) => r.label)}
        <div className="row" style={{ gap: 10, marginTop: 14, alignItems: "center" }}>
          <button className="btn">{t("notify.save")}</button>
          {saved && <span className="sub" role="status">{t("notify.saved")}</span>}
        </div>
      </form>
      <section className="card" aria-labelledby="nf-app" id="app">
        <h2 id="nf-app">{t("notify.app.title")}</h2>
        <p className="sub" style={{ margin: "6px 0 10px" }}>{t("notify.app.text")}</p>
        {apk
          ? <a className="btn" href="/app/download" download>{t("notify.app.download")} ({(apk.size / 1048576).toFixed(1)} MB)</a>
          : <p className="sub">{t("notify.app.missing")}</p>}
        <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>{t("notify.app.pwa")}</p>
      </section>
    </>
  );
}
