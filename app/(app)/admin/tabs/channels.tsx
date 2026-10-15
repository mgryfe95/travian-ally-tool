import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix, type Actor } from "@/lib/services/context";
import { TAG_COLORS } from "@/lib/services/chat";
import { archiveChannelAction, createChannelAction, deleteTagAction, moveChannelAction, saveTagAction, updateChannelAction } from "../actions";

const ROLES = ["GUEST", "MEMBER", "MODERATOR", "ADMIN"];
const ROLE_LABEL: Record<string, string> = { GUEST: "Gast", MEMBER: "Member", MODERATOR: "Moderator", ADMIN: "Admin" };
const COLOR_LABEL: Record<string, string> = { red: "Rot", amber: "Gelb", blue: "Blau", green: "Grün", purple: "Violett", gray: "Grau" };

function RoleSelect({ name, value }: { name: string; value: string }) {
  return (
    <select name={name} defaultValue={value} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={name === "minReadRole" ? "Lesen ab" : "Schreiben ab"}>
      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
  );
}

export async function ChannelsTab({ actor }: { actor: Actor }) {
  const matrix = await loadMatrix(db);
  const canChannels = hasPermission(actor.role, "settings.edit", matrix);
  const canTags = hasPermission(actor.role, "tags.manage", matrix);
  const [channels, tags] = await Promise.all([
    db.channel.findMany({ where: { tree: "ALLY", archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    db.tag.findMany({ orderBy: { id: "asc" } }),
  ]);
  return (
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <section className="card">
        <div className="row between" style={{ marginBottom: 10 }}><h2>Allianz-Kanäle</h2></div>
        {channels.map((c, i) => (
          <form key={c.id} action={updateChannelAction} className="row" style={{ padding: "6px 0", borderBottom: "1px solid var(--line2)", flexWrap: "wrap" }}>
            <input type="hidden" name="channelId" value={c.id} />
            <input name="name" defaultValue={c.name} className="field" style={{ minHeight: 36, minWidth: 140, flex: "1 1 140px" }} aria-label="Name" disabled={!canChannels} />
            <span className="sub" style={{ fontSize: 12 }}>lesen</span><RoleSelect name="minReadRole" value={c.minReadRole} />
            <span className="sub" style={{ fontSize: 12 }}>schreiben</span><RoleSelect name="minWriteRole" value={c.minWriteRole} />
            {canChannels && (
              <>
                <button className="btn ghost sm">Speichern</button>
                <button formAction={moveChannelAction} name="dir" value="up" className="btn ghost sm" disabled={i === 0} aria-label="nach oben">↑</button>
                <button formAction={moveChannelAction} name="dir" value="down" className="btn ghost sm" disabled={i === channels.length - 1} aria-label="nach unten">↓</button>
                <button formAction={archiveChannelAction} className="btn ghost sm" aria-label={`${c.name} archivieren`}>Archiv</button>
              </>
            )}
          </form>
        ))}
        {canChannels && (
          <form action={createChannelAction} className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <input name="name" className="field" placeholder="Neuer Kanal" aria-label="Neuer Kanal" required minLength={2} style={{ minHeight: 36 }} />
            <RoleSelect name="minReadRole" value="MEMBER" /><RoleSelect name="minWriteRole" value="MEMBER" />
            <button className="btn ghost sm">Kanal anlegen</button>
          </form>
        )}
        <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>Task-Force-Kanäle entstehen automatisch mit der Task-Force und erscheinen hier nicht.</p>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 10 }}>Tags</h2>
        {tags.map((t) => (
          <form key={t.id} action={saveTagAction} className="row" style={{ padding: "6px 0", borderBottom: "1px solid var(--line2)", flexWrap: "wrap" }}>
            <input type="hidden" name="tagId" value={t.id} />
            <span className={`pill t-${t.color}`} style={{ minWidth: 70, textAlign: "center" }}>{t.name}</span>
            {canTags && (
              <>
                <input name="name" defaultValue={t.name} className="field" style={{ minHeight: 36 }} aria-label="Tag-Name" />
                <select name="color" defaultValue={t.color} className="field" style={{ width: "auto", minHeight: 36 }} aria-label="Farbe">{TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}</select>
                <button className="btn ghost sm">Speichern</button>
                <button formAction={deleteTagAction} className="btn ghost sm">Löschen</button>
              </>
            )}
          </form>
        ))}
        {canTags && (
          <form action={saveTagAction} className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <input name="name" className="field" placeholder="Neuer Tag" aria-label="Neuer Tag" required minLength={2} style={{ minHeight: 36 }} />
            <select name="color" className="field" style={{ width: "auto", minHeight: 36 }} aria-label="Neue Farbe">{TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}</select>
            <button className="btn ghost sm">Tag anlegen</button>
          </form>
        )}
        <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>Die Farbpaare sind vorgegeben, damit der Kontrast immer ausreicht.</p>
      </section>
    </div>
  );
}
