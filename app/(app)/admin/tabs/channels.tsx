import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix, type Actor } from "@/lib/services/context";
import { listTagTypes, TAG_COLORS } from "@/lib/services/chat";
import { archiveChannelAction, createChannelAction, deleteTagAction, deleteTagTypeAction, moveChannelAction, saveTagAction, saveTagTypeAction, updateChannelAction } from "../actions";

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
  const [channels, types] = await Promise.all([
    db.channel.findMany({ where: { tree: "ALLY", archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    listTagTypes(db),
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
        <h2 style={{ marginBottom: 4 }}>Tag-Typen &amp; Tags</h2>
        <p className="sub" style={{ margin: "0 0 12px", fontSize: 12 }}>Ein Tag-Typ ist eine Achse (z. B. „Priorität“, „Status“) mit eigenen Tags. Er wird einzelnen Kanälen zugewiesen; nur dort kann er beim Schreiben gewählt werden.</p>
        {types.map((t) => (
          <div key={t.id} style={{ borderTop: "1px solid var(--line2)", padding: "12px 0" }}>
            <form action={saveTagTypeAction} className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <input type="hidden" name="tagTypeId" value={t.id} />
              <input name="name" defaultValue={t.name} className="field" style={{ minHeight: 36, minWidth: 140, flex: "1 1 140px", fontWeight: 600 }} aria-label="Typ-Name" disabled={!canTags} />
              <select name="multi" defaultValue={t.multi ? "1" : "0"} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={`Auswahl für ${t.name}`} disabled={!canTags}>
                <option value="0">ein Tag</option><option value="1">mehrere Tags</option>
              </select>
              <label className="sub" style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="required" defaultChecked={t.required} disabled={!canTags} /> Pflicht</label>
              <label className="sub" style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="forTaskforces" defaultChecked={t.forTaskforces} disabled={!canTags} /> Task-Forces</label>
              <fieldset style={{ border: 0, padding: 0, margin: 0, flexBasis: "100%" }}>
                <legend className="sub" style={{ fontSize: 12, padding: 0 }}>Gilt in diesen Kanälen</legend>
                <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                  {channels.map((c) => (
                    <label key={c.id} className="sub" style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
                      <input type="checkbox" name="channelIds" value={c.id} defaultChecked={t.channelIds.includes(c.id)} disabled={!canTags} /> {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              {canTags && (
                <>
                  <button className="btn ghost sm">Typ speichern</button>
                  <button formAction={deleteTagTypeAction} className="btn ghost sm" aria-label={`Typ ${t.name} löschen`}>Typ löschen</button>
                </>
              )}
            </form>
            <div style={{ marginTop: 8, paddingLeft: 12 }}>
              {t.tags.map((g) => (
                <form key={g.id} action={saveTagAction} className="row" style={{ padding: "4px 0", flexWrap: "wrap" }}>
                  <input type="hidden" name="tagId" value={g.id} />
                  <span className={`pill t-${g.color}`} style={{ minWidth: 70, textAlign: "center" }}>{g.name}</span>
                  {canTags && (
                    <>
                      <input name="name" defaultValue={g.name} className="field" style={{ minHeight: 36, flex: "1 1 120px" }} aria-label="Tag-Name" />
                      <select name="color" defaultValue={g.color} className="field" style={{ width: "auto", minHeight: 36 }} aria-label="Farbe">{TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}</select>
                      <button className="btn ghost sm">Speichern</button>
                      <button formAction={deleteTagAction} className="btn ghost sm">Löschen</button>
                    </>
                  )}
                </form>
              ))}
              {canTags && (
                <form action={saveTagAction} className="row" style={{ marginTop: 6, flexWrap: "wrap" }}>
                  <input type="hidden" name="tagTypeId" value={t.id} />
                  <input name="name" className="field" placeholder={`Neuer Tag in „${t.name}“`} aria-label={`Neuer Tag in ${t.name}`} required minLength={2} style={{ minHeight: 36, flex: "1 1 160px" }} />
                  <select name="color" className="field" style={{ width: "auto", minHeight: 36 }} aria-label="Neue Farbe">{TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}</select>
                  <button className="btn ghost sm">Tag anlegen</button>
                </form>
              )}
            </div>
          </div>
        ))}
        {canTags && (
          <form action={saveTagTypeAction} className="row" style={{ marginTop: 8, flexWrap: "wrap", borderTop: "1px solid var(--line2)", paddingTop: 12 }}>
            <input name="name" className="field" placeholder="Neuer Tag-Typ (z. B. Priorität)" aria-label="Neuer Tag-Typ" required minLength={2} style={{ minHeight: 36, flex: "1 1 200px" }} />
            <select name="multi" className="field" style={{ width: "auto", minHeight: 36 }} aria-label="Auswahl neuer Typ"><option value="0">ein Tag</option><option value="1">mehrere Tags</option></select>
            <input type="hidden" name="forTaskforces" value="on" />
            <button className="btn ghost sm">Typ anlegen</button>
          </form>
        )}
        <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>Die Farbpaare sind vorgegeben, damit der Kontrast immer ausreicht. Kanäle ordnest Du nach dem Anlegen zu. Ein Typ lässt sich erst löschen, wenn er keine Tags mehr hat.</p>
      </section>
    </div>
  );
}
