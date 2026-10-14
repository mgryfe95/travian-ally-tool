import { notFound } from "next/navigation";
import { canManageTaskforce, canReadChannel } from "@/lib/chat/access";
import { db } from "@/lib/db";
import { chatCtx } from "@/lib/services/chat";
import { requirePermission } from "@/lib/session";
import { addMemberAction, archiveTaskforceAction, removeMemberAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function TaskforcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requirePermission("chat.read");
  const id = Number((await params).id);
  const { error } = await searchParams;
  const tf = Number.isInteger(id) ? await db.taskforce.findUnique({ where: { id }, include: { members: true, channel: true } }) : null;
  const ctx = await chatCtx(db, user);
  // Nicht-Mitglieder erfahren nicht einmal, dass es die Task-Force gibt.
  if (!tf || !tf.channel || tf.archivedAt || !canReadChannel(tf.channel, ctx)) notFound();
  const me = tf.members.find((m) => m.userId === user.id);
  const manage = canManageTaskforce(ctx, me?.role === "lead");
  const users = await db.user.findMany({ where: { banned: false, role: { not: "GUEST" } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  const candidates = users.filter((u) => !tf.members.some((m) => m.userId === u.id));
  return (
    <div style={{ padding: "28px clamp(16px,3vw,40px)", maxWidth: 720 }}>
      <a href={`/chat?c=${tf.channel.id}`} style={{ fontSize: 13 }}>← Zum Kanal</a>
      <h1>{tf.name}</h1>
      {tf.description && <p className="sub" style={{ margin: "4px 0 16px" }}>{tf.description}</p>}
      {error && <p className="errtext" role="alert">{error}</p>}
      <section className="card flush" style={{ marginTop: 12 }}>
        <h2 style={{ margin: "12px 12px 8px" }}>Mitglieder ({tf.members.length})</h2>
        <table>
          <tbody>
            {tf.members.map((m) => (
              <tr key={m.userId}>
                <td>{name.get(m.userId) ?? m.userId}</td>
                <td><span className={`pill ${m.role === "lead" ? "p-ok" : "p-none"}`}>{m.role === "lead" ? "Lead" : "Mitglied"}</span></td>
                <td className="r">{manage && <form action={removeMemberAction}><input type="hidden" name="taskforceId" value={tf.id} /><input type="hidden" name="userId" value={m.userId} /><button className="btn ghost sm">Entfernen</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {manage && (
        <>
          <form action={addMemberAction} className="card row" style={{ marginTop: 16 }}>
            <input type="hidden" name="taskforceId" value={tf.id} />
            <label className="sr" htmlFor="u">Mitglied hinzufügen</label>
            <select id="u" name="userId" className="field" style={{ width: "auto" }} required>
              <option value="">Mitglied hinzufügen …</option>
              {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select name="role" className="field" style={{ width: "auto" }} aria-label="Rolle"><option value="member">Mitglied</option><option value="lead">Lead</option></select>
            <button className="btn">Hinzufügen</button>
          </form>
          <form action={archiveTaskforceAction} style={{ marginTop: 16 }}>
            <input type="hidden" name="taskforceId" value={tf.id} />
            <button className="btn ghost">Task-Force archivieren</button>
          </form>
        </>
      )}
    </div>
  );
}
