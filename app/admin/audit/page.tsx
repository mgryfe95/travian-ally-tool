import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePermission("roles.assign", "permissions.edit");
  const rows = await db.auditLog.findMany({ orderBy: { id: "desc" }, take: 200 });
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold">Audit-Log</h1>
      <table className="mt-4 w-full text-left text-xs">
        <thead className="text-zinc-400"><tr><th>Zeit</th><th>Akteur</th><th>Aktion</th><th>Ziel</th><th>Vorher → Nachher</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-800 align-top">
              <td className="py-1">{r.at.toISOString().replace("T", " ").slice(0, 16)}</td><td>{r.actorId}</td><td>{r.action}</td><td>{r.target}</td>
              <td className="font-mono">{r.before ? JSON.stringify(r.before) : ""} → {r.after ? JSON.stringify(r.after) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
