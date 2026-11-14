import { InstallButton } from "@/components/InstallButton";
import { PushDevice } from "@/components/PushDevice";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { getNotifySettings, type PrefRow } from "@/lib/services/notify";
import { requireUser } from "@/lib/session";
import { saveNotifyAction } from "./actions";

export const dynamic = "force-dynamic";

/** „App“: Web-App (PWA) auf Android/iOS einrichten, Push auf diesem Gerät einschalten und eigene Benachrichtigungen wählen. */
export default async function AppPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const { saved } = await searchParams;
  const s = await getNotifySettings(db, user);
  const url = env().APP_URL.replace(/^https?:\/\//, "");
  const steps = (keys: string[]) => <ol style={{ paddingLeft: 20, margin: "8px 0 0", display: "grid", gap: 4 }}>{keys.map((k) => <li key={k}>{t(k as MessageKey, { url })}</li>)}</ol>;
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
        <div className="sub">{t("install.eyebrow")}</div>
        <h1>{t("install.title")}</h1>
        <p className="sub">{t("install.intro")}</p>
      </header>
      <InstallButton />
      <div className="row" style={{ gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
        <section className="card" aria-labelledby="app-android" style={{ flex: "1 1 300px" }}>
          <h2 id="app-android">{t("install.android.title")}</h2>
          {steps(["install.android.1", "install.android.2", "install.android.3"])}
        </section>
        <section className="card" aria-labelledby="app-ios" style={{ flex: "1 1 300px" }}>
          <h2 id="app-ios">{t("install.ios.title")}</h2>
          {steps(["install.ios.1", "install.ios.2", "install.ios.3"])}
        </section>
      </div>
      <section className="card hi" aria-labelledby="app-dev" id="device">
        <h2 id="app-dev">{t("notify.device")}</h2>
        <p className="sub" style={{ margin: "4px 0 10px" }}>{t("install.push")}</p>
        <PushDevice />
        <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>{t("notify.devices", { n: s.devices })}</p>
      </section>
      <form action={saveNotifyAction} className="card" aria-labelledby="app-prefs" id="prefs">
        <h2 id="app-prefs">{t("notify.title")}</h2>
        <p className="sub" style={{ margin: "4px 0 8px" }}>{t("notify.intro")}</p>
        <h3>{t("notify.general")}</h3>
        {list(s.general, (r) => t(`notify.key.${r.key}` as MessageKey))}
        <h3 style={{ marginTop: 16 }}>{t("notify.channels")}</h3>
        {list(s.channels, (r) => `#${r.label}`)}
        <h3 style={{ marginTop: 16 }}>{t("notify.taskforces")}</h3>
        {list(s.taskforces, (r) => r.label)}
        <div className="row" style={{ gap: 10, marginTop: 14, alignItems: "center" }}>
          <button className="btn">{t("notify.save")}</button>
          {saved && <span className="sub" role="status">{t("notify.saved")}</span>}
        </div>
      </form>
    </>
  );
}
