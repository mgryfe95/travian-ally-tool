import Link from "next/link";
import { runAdviceAction, setRecommendationStatusAction } from "@/app/(app)/advice/actions";
import type { MessageKey, T } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { AdviceStatus } from "@/lib/services/advice";

type Rec = { id: number; villageId: number | null; type: string; priority: number; title: string; reason: string };

/** KI-Vorschläge mit Knopf „aktualisieren“ (1×/Tag) und Erledigt/Verwerfen je Eintrag. */
export function AdvicePanel(props: {
  t: T; locale: Locale; title: string; sub: string; recs: Rec[]; status: AdviceStatus; back: string;
  villageNames?: Map<number, string>; showButton?: boolean; error?: string; fresh?: boolean;
}) {
  const { t, locale, recs, status, back } = props;
  const s = status.spend;
  return (
    <section id="tips" className="card hi" aria-labelledby="tips-h">
      <div className="row between" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 id="tips-h">{props.title}</h2>
        {status.lastRun && <span className="sub" style={{ fontSize: 12 }}>{t("advice.lastRun", { date: fmtDate(status.lastRun.createdAt, locale) })}</span>}
      </div>
      <div className="sub" style={{ margin: "4px 0 10px" }}>{props.sub}</div>
      {status.lastRun?.summary && props.showButton && <p style={{ margin: "0 0 10px" }}>{status.lastRun.summary}</p>}
      {recs.length === 0 ? <p className="sub">{t("advice.none")}</p> : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {recs.map((r) => (
            <li key={r.id} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--raised)" }}>
              <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <span className={`pill ${r.priority <= 2 ? "p-bad" : r.priority === 3 ? "p-wait" : "p-none"}`} style={{ marginRight: 8 }}>{t("advice.prio", { n: r.priority })}</span>
                  <span className="pill p-none" style={{ marginRight: 8 }}>{t(`advice.type.${r.type}` as MessageKey)}</span>
                  <strong>{r.title}</strong>
                  {r.villageId !== null && props.villageNames?.get(r.villageId) && <> · <Link href={`/villages/${r.villageId}#tips`}>{props.villageNames.get(r.villageId)}</Link></>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {(["done", "dismissed"] as const).map((st) => (
                    <form key={st} action={setRecommendationStatusAction}>
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={st} /><input type="hidden" name="back" value={back} />
                      <button className="btn ghost sm">{t(`advice.mark.${st}`)}</button>
                    </form>
                  ))}
                </div>
              </div>
              {r.reason && <div className="sub" style={{ marginTop: 6 }}>{r.reason}</div>}
            </li>
          ))}
        </ol>
      )}
      {props.showButton && (
        <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <form action={runAdviceAction}><input type="hidden" name="back" value={back} /><button className="btn" disabled={!status.allowed}>{t("advice.run")}</button></form>
          {!status.allowed && status.reason && <span className="sub">{t(`err.advice.gate.${status.reason}` as MessageKey)}</span>}
          {props.fresh && <span className="sub" role="status">{t("advice.fresh")}</span>}
          {props.error && <span className="errtext" role="alert">{props.error}</span>}
          <span className="sub" style={{ fontSize: 12, marginLeft: "auto" }}>{t("advice.budget", { used: s.totalEur.toFixed(2), budget: s.budgetEur.toFixed(0) })}</span>
        </div>
      )}
    </section>
  );
}
