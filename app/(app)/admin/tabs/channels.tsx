import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import type { MessageKey, T } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { loadMatrix, type Actor } from "@/lib/services/context";
import { listTagTypes, TAG_COLORS } from "@/lib/services/chat";
import { archiveChannelAction, createChannelAction, deleteTagAction, deleteTagTypeAction, moveChannelAction, saveTagAction, saveTagTypeAction, updateChannelAction } from "../actions";

const ROLES = ["GUEST", "MEMBER", "MODERATOR", "ADMIN"];
const ROLE_LABEL: Record<string, MessageKey> = { GUEST: "admin.role.GUEST", MEMBER: "admin.role.MEMBER", MODERATOR: "admin.role.MODERATOR", ADMIN: "admin.role.ADMIN" };
const COLOR_LABEL: Record<string, MessageKey> = { red: "admin.channels.colorRed", amber: "admin.channels.colorAmber", blue: "admin.channels.colorBlue", green: "admin.channels.colorGreen", purple: "admin.channels.colorPurple", gray: "admin.channels.colorGray" };

function RoleSelect({ name, value, t }: { name: string; value: string; t: T }) {
  return (
    <select name={name} defaultValue={value} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={name === "minReadRole" ? t("admin.channels.readFrom") : t("admin.channels.writeFrom")}>
      {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r]!)}</option>)}
    </select>
  );
}

export async function ChannelsTab({ actor }: { actor: Actor }) {
  const { t } = await getT();
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
        <div className="row between" style={{ marginBottom: 10 }}><h2>{t("admin.channels.title")}</h2></div>
        {channels.map((c, i) => (
          <form key={c.id} action={updateChannelAction} className="row" style={{ padding: "6px 0", borderBottom: "1px solid var(--line2)", flexWrap: "wrap" }}>
            <input type="hidden" name="channelId" value={c.id} />
            <input name="name" defaultValue={c.name} className="field" style={{ minHeight: 36, minWidth: 140, flex: "1 1 140px" }} aria-label={t("admin.channels.name")} disabled={!canChannels} />
            <span className="sub" style={{ fontSize: 12 }}>{t("admin.channels.read")}</span><RoleSelect t={t} name="minReadRole" value={c.minReadRole} />
            <span className="sub" style={{ fontSize: 12 }}>{t("admin.channels.write")}</span><RoleSelect t={t} name="minWriteRole" value={c.minWriteRole} />
            {canChannels && (
              <>
                <button className="btn ghost sm">{t("admin.channels.save")}</button>
                <button formAction={moveChannelAction} name="dir" value="up" className="btn ghost sm" disabled={i === 0} aria-label={t("admin.channels.up")}>↑</button>
                <button formAction={moveChannelAction} name="dir" value="down" className="btn ghost sm" disabled={i === channels.length - 1} aria-label={t("admin.channels.down")}>↓</button>
                <button formAction={archiveChannelAction} className="btn ghost sm" aria-label={t("admin.channels.archiveChannel", { name: c.name })}>{t("admin.channels.archive")}</button>
              </>
            )}
          </form>
        ))}
        {canChannels && (
          <form action={createChannelAction} className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <input name="name" className="field" placeholder={t("admin.channels.newChannel")} aria-label={t("admin.channels.newChannel")} required minLength={2} style={{ minHeight: 36 }} />
            <RoleSelect t={t} name="minReadRole" value="MEMBER" /><RoleSelect t={t} name="minWriteRole" value="MEMBER" />
            <button className="btn ghost sm">{t("admin.channels.create")}</button>
          </form>
        )}
        <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>{t("admin.channels.taskforceNote")}</p>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 4 }}>{t("admin.tagTypes.title")}</h2>
        <p className="sub" style={{ margin: "0 0 12px", fontSize: 12 }}>{t("admin.tagTypes.intro")}</p>
        {types.map((ty) => (
          <div key={ty.id} style={{ borderTop: "1px solid var(--line2)", padding: "12px 0" }}>
            <form action={saveTagTypeAction} className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <input type="hidden" name="tagTypeId" value={ty.id} />
              <input name="name" defaultValue={ty.name} className="field" style={{ minHeight: 36, minWidth: 140, flex: "1 1 140px", fontWeight: 600 }} aria-label={t("admin.tagTypes.typeName")} disabled={!canTags} />
              <select name="multi" defaultValue={ty.multi ? "1" : "0"} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("admin.tagTypes.choiceFor", { name: ty.name })} disabled={!canTags}>
                <option value="0">{t("admin.tagTypes.single")}</option><option value="1">{t("admin.tagTypes.multiple")}</option>
              </select>
              <label className="sub" style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="required" defaultChecked={ty.required} disabled={!canTags} /> {t("admin.tagTypes.required")}</label>
              <label className="sub" style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="forTaskforces" defaultChecked={ty.forTaskforces} disabled={!canTags} /> {t("admin.tagTypes.taskforces")}</label>
              <fieldset style={{ border: 0, padding: 0, margin: 0, flexBasis: "100%" }}>
                <legend className="sub" style={{ fontSize: 12, padding: 0 }}>{t("admin.tagTypes.appliesTo")}</legend>
                <div className="row" style={{ gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                  {channels.map((c) => (
                    <label key={c.id} className="sub" style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
                      <input type="checkbox" name="channelIds" value={c.id} defaultChecked={ty.channelIds.includes(c.id)} disabled={!canTags} /> {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              {canTags && (
                <>
                  <button className="btn ghost sm">{t("admin.tagTypes.saveType")}</button>
                  <button formAction={deleteTagTypeAction} className="btn ghost sm" aria-label={t("admin.tagTypes.deleteTypeNamed", { name: ty.name })}>{t("admin.tagTypes.deleteType")}</button>
                </>
              )}
            </form>
            <div style={{ marginTop: 8, paddingLeft: 12 }}>
              {ty.tags.map((g) => (
                <form key={g.id} action={saveTagAction} className="row" style={{ padding: "4px 0", flexWrap: "wrap" }}>
                  <input type="hidden" name="tagId" value={g.id} />
                  <span className={`pill t-${g.color}`} style={{ minWidth: 70, textAlign: "center" }}>{g.name}</span>
                  {canTags && (
                    <>
                      <input name="name" defaultValue={g.name} className="field" style={{ minHeight: 36, flex: "1 1 120px" }} aria-label={t("admin.tags.name")} />
                      <select name="color" defaultValue={g.color} className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("admin.tags.color")}>{TAG_COLORS.map((c) => <option key={c} value={c}>{t(COLOR_LABEL[c]!)}</option>)}</select>
                      <button className="btn ghost sm">{t("admin.tags.save")}</button>
                      <button formAction={deleteTagAction} className="btn ghost sm">{t("admin.tags.delete")}</button>
                    </>
                  )}
                </form>
              ))}
              {canTags && (
                <form action={saveTagAction} className="row" style={{ marginTop: 6, flexWrap: "wrap" }}>
                  <input type="hidden" name="tagTypeId" value={ty.id} />
                  <input name="name" className="field" placeholder={t("admin.tags.newIn", { name: ty.name })} aria-label={t("admin.tags.newInAria", { name: ty.name })} required minLength={2} style={{ minHeight: 36, flex: "1 1 160px" }} />
                  <select name="color" className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("admin.tags.newColor")}>{TAG_COLORS.map((c) => <option key={c} value={c}>{t(COLOR_LABEL[c]!)}</option>)}</select>
                  <button className="btn ghost sm">{t("admin.tags.create")}</button>
                </form>
              )}
            </div>
          </div>
        ))}
        {canTags && (
          <form action={saveTagTypeAction} className="row" style={{ marginTop: 8, flexWrap: "wrap", borderTop: "1px solid var(--line2)", paddingTop: 12 }}>
            <input name="name" className="field" placeholder={t("admin.tagTypes.newPlaceholder")} aria-label={t("admin.tagTypes.newAria")} required minLength={2} style={{ minHeight: 36, flex: "1 1 200px" }} />
            <select name="multi" className="field" style={{ width: "auto", minHeight: 36 }} aria-label={t("admin.tagTypes.newChoiceAria")}><option value="0">{t("admin.tagTypes.single")}</option><option value="1">{t("admin.tagTypes.multiple")}</option></select>
            <input type="hidden" name="forTaskforces" value="on" />
            <button className="btn ghost sm">{t("admin.tagTypes.create")}</button>
          </form>
        )}
        <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>{t("admin.tagTypes.footer")}</p>
      </section>
    </div>
  );
}
