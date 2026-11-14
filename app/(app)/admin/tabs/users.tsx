import { RoleSelect } from "@/components/AdminControls";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { effectiveRole, isEmergencyAdmin, rank, STORED_ROLES } from "@/lib/permissions";
import type { Actor } from "@/lib/services/context";
import { hasPermission } from "@/lib/permissions";
import { loadGroupPlayers } from "@/lib/alliance-group";
import { loadMatrix } from "@/lib/services/context";
import { assignPlayerAction, banAction, betaTesterAction, deleteUserAction } from "../actions";

export async function UsersTab({ actor }: { actor: Actor }) {
  const { t } = await getT();
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" }, include: { links: { where: { status: "verified" } } } });
  const sys = env().SYSTEMADMIN_EMAILS;
  const matrix = await loadMatrix(db);
  const canAssign = hasPermission(actor.role, "members.approve", matrix);
  const canBeta = hasPermission(actor.role, "roles.assign", matrix);
  const players = canAssign ? await loadGroupPlayers(db) : [];
  const playerName = new Map((await db.player.findMany({ where: { id: { in: users.flatMap((u) => u.links.map((l) => l.travianPlayerId)) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const assignable = STORED_ROLES.filter((r) => actor.role === "ADMIN" || rank(r) < rank(actor.role)).reverse() as string[];
  return (
    <section className="card flush">
      <div style={{ margin: 12 }}>
        <h2>{t("admin.users.title")}</h2>
      </div>
      <div className="scroll">
        <table style={{ minWidth: 1100 }}>
          <thead><tr><th>{t("admin.users.colName")}</th><th>{t("admin.users.colRole")}</th><th>{t("admin.users.colStatus")}</th><th>{t("admin.users.colPlayer")}</th><th>{t("beta.col")}</th><th /></tr></thead>
          <tbody>
            {users.map((u) => {
              const role = effectiveRole(u, sys);
              const locked = isEmergencyAdmin(u.email, sys); // Admin per Server-Konfiguration: Rolle/Sperre dort bestimmt
              const editable = !locked && (actor.role === "ADMIN" || rank(role) < rank(actor.role));
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td>{locked ? <>{t(`admin.role.${role}`)} <span className="sub" style={{ fontSize: 12 }}>· {t("admin.users.emergency")}</span></> : editable ? <RoleSelect userId={u.id} current={role} options={assignable} tab="users" /> : t(`admin.role.${role}`)}</td>
                  <td>{u.banned ? <span className="pill p-bad">{t("admin.users.banned")}</span> : u.links.length ? <span className="pill p-ok">{t("admin.users.verified")}</span> : <span className="pill p-none">{t("admin.users.guest")}</span>}</td>
                  <td>
                    {u.links.length > 0 && <span className="sub">{u.links.map((l) => playerName.get(l.travianPlayerId) ?? `#${l.travianPlayerId}`).join(", ")}</span>}
                    {canAssign && !u.banned && (
                      <form action={assignPlayerAction} className="row" style={{ flexWrap: "nowrap", gap: 6, marginTop: u.links.length ? 6 : 0 }}>
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="playerId" aria-label={t("admin.users.playerFor", { name: u.name })} defaultValue="">
                          <option value="" disabled>{t("admin.users.choosePlayer")}</option>
                          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button className="btn ghost sm">{t("admin.users.assign")}</button>
                      </form>
                    )}
                  </td>
                  <td>
                    {canBeta ? (
                      <form action={betaTesterAction} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="on" value={u.betaTester ? "0" : "1"} />
                        {u.betaTester && <span className="pill p-ok">{t("beta.on")}</span>}
                        <button className="btn ghost sm">{u.betaTester ? t("beta.remove") : t("beta.make")}</button>
                      </form>
                    ) : <span className="sub">{u.betaTester ? t("beta.on") : t("beta.off")}</span>}
                  </td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {editable && (
                      <span className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <form action={banAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="banned" value={u.banned ? "0" : "1"} /><button className="btn ghost sm">{u.banned ? t("admin.users.unban") : t("admin.users.ban")}</button></form>
                        <form action={deleteUserAction}><input type="hidden" name="userId" value={u.id} /><button className="btn ghost sm">{t("admin.users.delete")}</button></form>
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
