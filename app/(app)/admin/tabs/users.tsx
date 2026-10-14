import { RoleSelect } from "@/components/AdminControls";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { effectiveRole, rank, STORED_ROLES } from "@/lib/permissions";
import type { Actor } from "@/lib/services/context";
import { banAction, deleteUserAction } from "../actions";

export async function UsersTab({ actor }: { actor: Actor }) {
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" }, include: { links: { where: { status: "verified" } } } });
  const sys = env().SYSTEMADMIN_EMAILS;
  const assignable = STORED_ROLES.filter((r) => actor.role === "SYSTEMADMIN" || rank(r) < rank(actor.role)).reverse() as string[];
  return (
    <section className="card flush">
      <div style={{ margin: 12 }}>
        <h2>Alle Konten</h2>
        <div className="sub">SYSTEMADMIN-Konten kommen aus der Server-Konfiguration und sind hier nicht änderbar.</div>
      </div>
      <div className="scroll">
        <table style={{ minWidth: 760 }}>
          <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => {
              const role = effectiveRole(u, sys);
              const locked = role === "SYSTEMADMIN";
              const editable = !locked && (actor.role === "SYSTEMADMIN" || rank(role) < rank(actor.role));
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td style={{ color: "var(--text2)" }}>{u.email}</td>
                  <td>{locked ? <b style={{ color: "var(--link-h)" }}>🔒 Systemadmin</b> : editable ? <RoleSelect userId={u.id} current={role} options={assignable} tab="users" /> : role}</td>
                  <td>{u.banned ? <span className="pill p-bad">gesperrt</span> : u.links.length ? <span className="pill p-ok">verifiziert</span> : <span className="pill p-none">Gast</span>}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {editable && (
                      <span className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <form action={banAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="banned" value={u.banned ? "0" : "1"} /><button className="btn ghost sm">{u.banned ? "Entsperren" : "Sperren"}</button></form>
                        <form action={deleteUserAction}><input type="hidden" name="userId" value={u.id} /><button className="btn ghost sm">Löschen</button></form>
                      </span>
                    )}
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
