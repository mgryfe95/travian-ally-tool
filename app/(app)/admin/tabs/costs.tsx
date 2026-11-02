import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { COST_DEFAULTS, getCostSettings, monthByFeature, monthSpend, pricesStale } from "@/lib/ai/usage";
import { saveCostSettingsAction } from "../actions";

const FIELDS: { key: keyof typeof COST_DEFAULTS; label: MessageKey; step: string }[] = [
  { key: "aiBudgetEur", label: "admin.costs.budget", step: "1" },
  { key: "usdEur", label: "admin.costs.usdEur", step: "0.01" },
  { key: "s3IncludedTb", label: "admin.costs.s3Included", step: "0.1" },
  { key: "s3ExtraPerTbEur", label: "admin.costs.s3Extra", step: "0.01" },
];

/** KI- und Speicherkosten des Monats, Budget und Preise (Hetzner-Fixum zählt nicht mit). */
export async function CostsTab() {
  const { t, locale } = await getT();
  const [spend, cfg, byFeature] = await Promise.all([monthSpend(db), getCostSettings(db), monthByFeature(db)]);
  const eur = (n: number) => `${n.toFixed(2)} €`;
  return (
    <>
      <section className="card">
        <h2>{t("admin.costs.month")}</h2>
        <div className="scroll" style={{ marginTop: 8 }}>
          <table>
            <tbody>
              {byFeature.map((f) => <tr key={f.feature}><td>{t(`admin.costs.feature.${f.feature}` as MessageKey)}</td><td className="mono r">{t("admin.costs.calls", { n: f.calls })}</td><td className="mono r">{eur(f.usd * cfg.usdEur)}</td></tr>)}
              <tr><td>{t("admin.costs.s3", { gb: (spend.storageBytes / 1e9).toFixed(2) })}</td><td /><td className="mono r">{eur(spend.s3Eur)}</td></tr>
              <tr><td><b>{t("admin.costs.total")}</b></td><td className="sub r">{t("admin.costs.ofBudget", { budget: eur(spend.budgetEur) })}</td><td className="mono r"><b>{eur(spend.totalEur)}</b></td></tr>
            </tbody>
          </table>
        </div>
        {spend.exhausted && <p className="errtext" role="alert" style={{ marginTop: 8 }}>{t("admin.costs.exhausted")}</p>}
        <p className="sub" style={{ marginTop: 8, fontSize: 12 }}>{t("admin.costs.note")}</p>
      </section>
      <section className="card">
        <h2>{t("admin.costs.settings")}</h2>
        {pricesStale(cfg.pricesCheckedAt) && <p className="card warn" role="status" style={{ margin: "8px 0" }}>{t("admin.costs.stale")}</p>}
        <form action={saveCostSettingsAction} style={{ display: "grid", gap: 10, maxWidth: 420, marginTop: 8 }}>
          {FIELDS.map((f) => (
            <div key={f.key}><label className="lbl" htmlFor={`c-${f.key}`}>{t(f.label)}</label><input id={`c-${f.key}`} name={f.key} className="field" type="number" min="0" step={f.step} defaultValue={cfg[f.key]} /></div>
          ))}
          <label className="row" style={{ gap: 8 }}><input type="checkbox" name="checked" value="1" /> {t("admin.costs.checkedNow")}</label>
          <div className="sub" style={{ fontSize: 12 }}>{cfg.pricesCheckedAt ? t("admin.costs.checkedAt", { date: fmtDate(new Date(cfg.pricesCheckedAt), locale, { dateStyle: "medium" }) }) : t("admin.costs.neverChecked")}</div>
          <div><button className="btn">{t("admin.costs.save")}</button></div>
        </form>
      </section>
    </>
  );
}
