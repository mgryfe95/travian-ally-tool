import { db } from "@/lib/db";
import { isOwnGroup, loadRelations, RELATION_LABEL, RELATIONS } from "@/lib/alliance-group";
import { fmt } from "@/lib/format";
import { classifyAllianceAction } from "../actions";

export async function AlliancesTab({ q }: { q?: string }) {
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
        <h2>Allianzen & Allianz-Gruppe</h2>
        <div className="sub">Allianzen vom Typ <b>Eigene Allianz</b> oder <b>Allianz</b> bilden zusammen die eigene Gruppe und zählen überall (Einladungen, Abgleich, Filter) als eine Allianz.</div>
        <form style={{ marginTop: 10 }}><input type="hidden" name="tab" value="alliances" /><input name="q" defaultValue={q} placeholder="Allianz suchen" className="field" style={{ maxWidth: 280 }} /></form>
      </div>
      <div className="scroll">
        <table style={{ minWidth: 760 }}>
          <thead><tr><th>Allianz</th><th className="r">Mitgl.</th><th className="r">Einw.</th><th>Typ & Notiz</th></tr></thead>
          <tbody>
            {sorted.map((a) => {
              const rel = relations.get(a.id);
              return (
                <tr key={a.id} style={isOwnGroup(rel) ? { background: "rgba(217,164,65,.06)" } : undefined}>
                  <td>{a.name} <span className="sub mono">#{a.id}</span></td>
                  <td className="mono r">{a.memberCount}</td>
                  <td className="mono r">{fmt(a.population)}</td>
                  <td>
                    <form action={classifyAllianceAction} className="row" style={{ flexWrap: "nowrap" }}>
                      <input type="hidden" name="allianceId" value={a.id} />
                      <select name="relation" defaultValue={rel ?? "CLEAR"} className="field" style={{ width: "auto", minHeight: 36 }}>
                        <option value="CLEAR">– keine –</option>
                        {RELATIONS.map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
                      </select>
                      <input name="note" defaultValue={noteOf.get(a.id)} placeholder="Notiz" className="field" style={{ minHeight: 36 }} />
                      <button className="btn ghost sm">Speichern</button>
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
