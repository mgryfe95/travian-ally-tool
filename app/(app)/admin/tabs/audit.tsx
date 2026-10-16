import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";

export async function AuditTab() {
  const { t } = await getT();
  const rows = await db.auditLog.findMany({ orderBy: { id: "desc" }, take: 200 });
  return (
    <section className="card flush">
      <h2 style={{ margin: 12 }}>{t("admin.audit.title")}</h2>
      <div className="scroll">
        <table style={{ minWidth: 760, fontSize: 12 }}>
          <thead><tr><th>{t("admin.audit.colTime")}</th><th>{t("admin.audit.colActor")}</th><th>{t("admin.audit.colAction")}</th><th>{t("admin.audit.colTarget")}</th><th>{t("admin.audit.colChange")}</th></tr></thead>
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
