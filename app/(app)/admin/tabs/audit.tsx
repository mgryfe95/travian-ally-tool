import { db } from "@/lib/db";

export async function AuditTab() {
  const rows = await db.auditLog.findMany({ orderBy: { id: "desc" }, take: 200 });
  return (
    <section className="card flush">
      <h2 style={{ margin: 12 }}>Audit-Log</h2>
      <div className="scroll">
        <table style={{ minWidth: 760, fontSize: 12 }}>
          <thead><tr><th>Zeit</th><th>Akteur</th><th>Aktion</th><th>Ziel</th><th>Vorher → Nachher</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.at.toISOString().replace("T", " ").slice(0, 16)}</td><td>{r.actorId}</td><td>{r.action}</td><td>{r.target}</td>
                <td className="mono">{r.before ? JSON.stringify(r.before) : ""} → {r.after ? JSON.stringify(r.after) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
