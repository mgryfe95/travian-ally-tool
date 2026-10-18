import { notFound } from "next/navigation";
import { canManageTaskforce, canReadChannel } from "@/lib/chat/access";
import { db } from "@/lib/db";
import { tfRoleLabel } from "@/components/chat/roles";
import { getT } from "@/lib/i18n/server";
import { chatCtx } from "@/lib/services/chat";
import { requirePermission } from "@/lib/session";
import { archiveTaskforceAction, inviteMemberAction, leaveTaskforceAction, removeMemberAction, revokeInviteAction, setRoleAction, transferFounderAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function TaskforcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { t } = await getT();
  const user = await requirePermission("chat.read");
  const id = Number((await params).id);
  const { error } = await searchParams;
  const tf = Number.isInteger(id) ? await db.taskforce.findUnique({ where: { id }, include: { members: true, channel: true } }) : null;
  const ctx = await chatCtx(db, user);
  // Nicht-Mitglieder erfahren nicht einmal, dass es die Task-Force gibt.
  if (!tf || !tf.channel || tf.archivedAt || !canReadChannel(tf.channel, ctx)) notFound();
  const me = tf.members.find((m) => m.userId === user.id);
  const isFounder = me?.role === "founder" || ctx.role === "ADMIN";
  const manage = canManageTaskforce(ctx, me?.role === "founder" || me?.role === "lead");
  const invites = manage ? await db.taskforceInvite.findMany({ where: { taskforceId: tf.id, status: "pending" }, orderBy: { id: "asc" } }) : [];
  const users = await db.user.findMany({ where: { banned: false, role: { not: "GUEST" } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  const candidates = users.filter((u) => !tf.members.some((m) => m.userId === u.id) && !invites.some((i) => i.userId === u.id));
  return (
    <div style={{ padding: "28px clamp(16px,3vw,40px)", maxWidth: 720 }}>
      <a href={`/chat?c=${tf.channel.id}`} style={{ fontSize: 13 }}>{t("chat.tf.back")}</a>
      <h1>{tf.name}</h1>
      {tf.description && <p className="sub" style={{ margin: "4px 0 16px" }}>{tf.description}</p>}
      {error && <p className="errtext" role="alert">{error}</p>}
      <section className="card flush" style={{ marginTop: 12 }}>
        <h2 style={{ margin: "12px 12px 8px" }}>{t("chat.tf.members", { n: tf.members.length })}</h2>
        <table>
          <tbody>
            {tf.members.map((m) => {
              const canRemove = manage && m.role !== "founder" && (m.role !== "lead" || isFounder);
              return (
                <tr key={m.userId}>
                  <td>{name.get(m.userId) ?? m.userId}</td>
                  <td>
                    {isFounder && m.role !== "founder" ? (
                      <form action={setRoleAction} className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                        <input type="hidden" name="taskforceId" value={tf.id} /><input type="hidden" name="userId" value={m.userId} />
                        <select name="role" defaultValue={m.role} className="field" style={{ width: "auto", minHeight: 32 }} aria-label={t("chat.tf.roleOf", { name: name.get(m.userId) ?? m.userId })}>
                          {(["lead", "member", "reader"] as const).map((r) => <option key={r} value={r}>{tfRoleLabel(t, r)}</option>)}
                        </select>
                        <button className="btn ghost sm">{t("chat.tf.change")}</button>
                      </form>
                    ) : <span className={`pill ${m.role === "founder" || m.role === "lead" ? "p-ok" : "p-none"}`}>{tfRoleLabel(t, m.role)}</span>}
                  </td>
                  <td className="r">{isFounder && m.role !== "founder" && <form action={transferFounderAction} style={{ display: "inline-block", marginRight: 6 }}><input type="hidden" name="taskforceId" value={tf.id} /><input type="hidden" name="userId" value={m.userId} /><button className="btn ghost sm">{t("chat.tf.makeFounder")}</button></form>}{canRemove && <form action={removeMemberAction} style={{ display: "inline-block" }}><input type="hidden" name="taskforceId" value={tf.id} /><input type="hidden" name="userId" value={m.userId} /><button className="btn ghost sm">{t("chat.tf.remove")}</button></form>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {manage && (
        <>
          <form action={inviteMemberAction} className="card row" style={{ marginTop: 16 }}>
            <input type="hidden" name="taskforceId" value={tf.id} />
            <label className="sr" htmlFor="u">{t("chat.tf.inviteMember")}</label>
            <select id="u" name="userId" className="field" style={{ width: "auto" }} required>
              <option value="">{t("chat.tf.inviteMemberOpt")}</option>
              {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select name="role" className="field" style={{ width: "auto" }} aria-label={t("chat.tf.roleAfterAccept")}>
              <option value="member">{t("chat.role.member")}</option><option value="reader">{t("chat.tf.readerOnly")}</option>{isFounder && <option value="lead">{t("chat.role.lead")}</option>}
            </select>
            <button className="btn">{t("chat.tf.invite")}</button>
          </form>
          {invites.length > 0 && (
            <section className="card flush" style={{ marginTop: 12 }}>
              <h2 style={{ margin: "12px 12px 8px" }}>{t("chat.tf.openInvites", { n: invites.length })}</h2>
              <table><tbody>{invites.map((i) => (
                <tr key={i.id}><td>{name.get(i.userId) ?? i.userId}</td><td><span className="pill p-wait">{tfRoleLabel(t, i.role)}</span></td>
                  <td className="r"><form action={revokeInviteAction}><input type="hidden" name="taskforceId" value={tf.id} /><input type="hidden" name="inviteId" value={i.id} /><button className="btn ghost sm">{t("chat.tf.revoke")}</button></form></td></tr>
              ))}</tbody></table>
            </section>
          )}
          {isFounder && (
            <form action={archiveTaskforceAction} style={{ marginTop: 16 }}>
              <input type="hidden" name="taskforceId" value={tf.id} />
              <button className="btn ghost">{t("chat.tf.archive")}</button>
            </form>
          )}
        </>
      )}
      {me && (
        <form action={leaveTaskforceAction} style={{ marginTop: 16 }}>
          <input type="hidden" name="taskforceId" value={tf.id} />
          {me.role === "founder" && <p className="sub" style={{ fontSize: 12, marginBottom: 6 }}>{t("chat.tf.founderLeaveHint")}</p>}
          <button className="btn ghost">{t("chat.tf.leave")}</button>
        </form>
      )}
    </div>
  );
}
