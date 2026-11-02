import { getT } from "@/lib/i18n/server";

export default async function PrivacyPage() {
  const { t } = await getT();
  return (
    <>
      <header>
        <div className="sub">{t("privacy.eyebrow")}</div>
        <h1>{t("privacy.title")}</h1>
      </header>
      {(["shots", "msg", "account"] as const).map((k) => (
        <section key={k} className="card" aria-labelledby={`pv-${k}`}>
          <h2 id={`pv-${k}`}>{t(`privacy.${k}.h`)}</h2>
          <p style={{ marginTop: 6 }}>{t(`privacy.${k}.p`)}</p>
        </section>
      ))}
    </>
  );
}
