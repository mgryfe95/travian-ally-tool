import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { createTaskforceAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewTaskforce({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requirePermission("taskforce.create");
  const { error } = await searchParams;
  const users = await db.user.findMany({ where: { banned: false, role: { not: "GUEST" }, id: { not: user.id } }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div style={{ padding: "28px clamp(16px,3vw,40px)", maxWidth: 640 }}>
      <h1>Task-Force anlegen</h1>
      <p className="sub" style={{ margin: "4px 0 16px" }}>Es entsteht ein eigener Kanal, den nur Mitglieder sehen (Admins sehen alle). Du wirst Gründer und verwaltest Rollen. Die gewählten Mitglieder erhalten eine Einladung und müssen sie annehmen.</p>
      <form action={createTaskforceAction} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label className="lbl" htmlFor="n">Name</label><input id="n" name="name" className="field" required minLength={2} maxLength={60} /></div>
        <div><label className="lbl" htmlFor="d">Beschreibung</label><textarea id="d" name="description" className="field" rows={3} /></div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="lbl">Einladen</legend>
          <div style={{ maxHeight: 220, overflow: "auto", display: "grid", gap: 4 }}>
            {users.map((u) => <label key={u.id} className="row" style={{ gap: 8 }}><input type="checkbox" name="members" value={u.id} />{u.name}</label>)}
            {users.length === 0 && <span className="sub">Noch keine weiteren Mitglieder.</span>}
          </div>
        </fieldset>
        {error && <p className="errtext" role="alert">{error}</p>}
        <div className="row"><button className="btn">Anlegen</button><a className="btn ghost" href="/chat">Abbrechen</a></div>
      </form>
    </div>
  );
}
