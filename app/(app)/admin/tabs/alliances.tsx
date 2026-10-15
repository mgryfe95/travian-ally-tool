import { db } from "@/lib/db";
import { isOwnGroup, loadRelations, RELATIONS } from "@/lib/alliance-group";
import { fmt } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { classifyAllianceAction } from "../actions";

export async function AlliancesTab({ q }: { q?: string }) {
  const { t, locale } = await getT();
  const [alliances, relations, notes] = await Promise.all([
    db.alliance.findMany({ where: q ? { name: { contains: q, mode: "insensitive" } } : undefined, orderBy: { population: "desc" }, take: 300 }),
    loadRelations(db),
    db.allianceClassification.findMany(),
  ]);
  const noteOf = new Map(notes.map((n) => [n.allianceId, n.note ?? ""]));
  const sorted = [...alliances].sort((a, b) => Number(relations.has(b.id)) - Number(relations.has(a.id)));
  return (
    <section className="card flush">
      <div style={{ margin: 12 }}>
        <h2>{t("admin.alliances.title")}</h2>
        <div className="sub">{t("admin.alliances.hint", { own: "\u0000own", allied: "\u0000allied" }).split(/\u0000(own|allied)/).map((part, i) => part === "own" ? <b key={i}>{t("admin.relation.OWN")}</b> : part === "allied" ? <b key={i}>{t("admin.relation.ALLIED")}</b> : part)}</div>
        <form style={{ marginTop: 10 }}><input type="hidden" name="tab" value="alliances" /><input name="q" defaultValue={q} placeholder={t("admin.alliances.searchPlaceholder")} className="field" style={{ maxWidth: 280 }} /></form>
      </div>
      <div className="scroll">
        <table style={{ minWidth: 760 }}>
          <thead><tr><th>{t("admin.alliances.colAlliance")}</th><th className="r">{t("admin.alliances.colMembers")}</th><th className="r">{t("admin.alliances.colPop")}</th><th>{t("admin.alliances.colTypeNote")}</th></tr></thead>
          <tbody>
            {sorted.map((a) => {
              const rel = relations.get(a.id);
              return (
                <tr key={a.id} style={isOwnGroup(rel) ? { background: "rgba(217,164,65,.06)" } : undefined}>
                  <td>{a.name} <span className="sub mono">#{a.id}</span></td>
                  <td className="mono r">{a.memberCount}</td>
                  <td className="mono r">{fmt(a.population, locale)}</td>
                  <td>
                    <form action={classifyAllianceAction} className="row" style={{ flexWrap: "nowrap" }}>
                      <input type="hidden" name="allianceId" value={a.id} />
                      <select name="relation" defaultValue={rel ?? "CLEAR"} className="field" style={{ width: "auto", minHeight: 36 }}>
                        <option value="CLEAR">{t("admin.relation.none")}</option>
                        {RELATIONS.map((r) => <option key={r} value={r}>{t(`admin.relation.${r}`)}</option>)}
                      </select>
                      <input name="note" defaultValue={noteOf.get(a.id)} placeholder={t("admin.alliances.notePlaceholder")} className="field" style={{ minHeight: 36 }} />
                      <button className="btn ghost sm">{t("admin.alliances.save")}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
