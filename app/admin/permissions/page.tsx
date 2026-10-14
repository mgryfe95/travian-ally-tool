import { db } from "@/lib/db";
import { PERMISSIONS, STORED_ROLES } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";
import { requirePermission } from "@/lib/session";
import { setPermissionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PermissionsAdmin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission("permissions.edit");
  const { error } = await searchParams;
  const matrix = await loadMatrix(db);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold">Rechte-Matrix</h1>
      <p className="mt-1 text-sm text-zinc-400">SYSTEMADMIN hat immer alle Rechte und ist hier nicht änderbar. permissions.edit / roles.assign der Rolle ADMIN ändert nur SYSTEMADMIN.</p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <table className="mt-4 text-sm">
        <thead className="text-zinc-400"><tr><th className="pr-6 text-left">Recht</th>{STORED_ROLES.map((r) => <th key={r} className="px-3">{r}</th>)}<th className="px-3">SYSTEMADMIN</th></tr></thead>
        <tbody>
          {PERMISSIONS.map((p) => (
            <tr key={p} className="border-t border-zinc-800">
              <td className="py-1 pr-6">{p}</td>
              {STORED_ROLES.map((r) => (
                <td key={r} className="px-3 text-center">
                  <form action={setPermissionAction}>
                    <input type="hidden" name="role" value={r} /><input type="hidden" name="permission" value={p} />
                    <input type="hidden" name="enabled" value={matrix[r].has(p) ? "0" : "1"} />
                    <button title="umschalten" className={matrix[r].has(p) ? "text-amber-400" : "text-zinc-600"}>{matrix[r].has(p) ? "✔" : "○"}</button>
                  </form>
                </td>
              ))}
              <td className="px-3 text-center text-zinc-500">✔</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
