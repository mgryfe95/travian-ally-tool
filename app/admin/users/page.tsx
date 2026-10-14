import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { effectiveRole, ROLES, STORED_ROLES } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { banAction, deleteUserAction, setRoleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission("roles.assign");
  const { error } = await searchParams;
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" }, include: { links: { where: { status: "verified" } } } });
  const sys = env().SYSTEMADMIN_EMAILS;
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold">Nutzer & Rollen</h1>
      <p className="mt-1 text-sm text-zinc-400">SYSTEMADMIN-Konten kommen aus der Server-Konfiguration und sind hier nicht änderbar.</p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <table className="mt-4 w-full text-left text-sm">
        <thead className="text-zinc-400"><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => {
            const role = effectiveRole(u, sys);
            const locked = role === "SYSTEMADMIN";
            return (
              <tr key={u.id} className="border-t border-zinc-800">
                <td className="py-1">{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {locked ? <b>SYSTEMADMIN</b> : (
                    <form action={setRoleAction} className="flex gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <select name="role" defaultValue={role} className="rounded border border-zinc-700 bg-zinc-900 px-1">
                        {ROLES.filter((r) => (STORED_ROLES as readonly string[]).includes(r)).map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <button className="rounded border border-zinc-700 px-2 hover:border-amber-400">OK</button>
                    </form>
                  )}
                </td>
                <td>{u.banned ? "gesperrt" : u.links.length ? "verifiziert" : "–"}</td>
                <td className="flex gap-2">
                  {!locked && (<>
                    <form action={banAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="banned" value={u.banned ? "0" : "1"} /><button className="rounded border border-zinc-700 px-2 hover:border-amber-400">{u.banned ? "Entsperren" : "Sperren"}</button></form>
                    <form action={deleteUserAction}><input type="hidden" name="userId" value={u.id} /><button className="rounded border border-zinc-700 px-2 hover:border-red-400">Löschen</button></form>
                  </>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
