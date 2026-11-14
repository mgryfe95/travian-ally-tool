import { verifiedUserWhere } from "@/lib/services/context";
import { ChatClient } from "@/components/chat/ChatClient";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hasPermission } from "@/lib/permissions";
import { tfRoleLabel } from "@/components/chat/roles";
import { getT } from "@/lib/i18n/server";
import { chatCtx, listChannels, listMessages, listMessagesAround, listMyTaskforceInvites, listTagTypes } from "@/lib/services/chat";
import { requirePermission } from "@/lib/session";
import { respondInviteAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string; tf?: string; m?: string }> }) {
  const { t } = await getT();
  const user = await requirePermission("chat.read");
  const sp = await searchParams;
  const ctx = await chatCtx(db, user);
  const channels = await listChannels(db, ctx);
  const tagTypes = await listTagTypes(db);
  const invites = await listMyTaskforceInvites(db, user.id);

  const requested = sp.c === "all" ? "all" : Number(sp.c);
  const byId = Number.isInteger(requested) ? channels.find((c) => c.id === requested) : undefined;
  // Standard: Sammelraum; „Task-Forces“ aus der Navigation springt in die erste Task-Force.
  const current: number | "all" = sp.c === "all" ? "all" : byId ? byId.id : sp.tf ? (channels.find((c) => c.tree === "TASKFORCE")?.id ?? "all") : "all";
  const focusId = Number.isInteger(Number(sp.m)) && typeof current === "number" ? Number(sp.m) : undefined;
  const initial = focusId ? await listMessagesAround(db, ctx, current as number, focusId) : await listMessages(db, ctx, { channelId: current });
  const people = await db.user.findMany({ where: verifiedUserWhere, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const cfg = env();

  return (
    <>
      {invites.length > 0 && (
        <section className="card" style={{ margin: "12px 24px 0" }} aria-label={t("chat.invites.label")}>
          <b>{t("chat.invites.title")}</b>
          {invites.map((i) => (
            <form key={i.id} action={respondInviteAction} className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
              <input type="hidden" name="inviteId" value={i.id} />
              <span>{t("chat.invites.textPre", { inviter: i.invitedBy })} <b>{i.taskforce.name}</b> {t("chat.invites.textPost", { role: tfRoleLabel(t, i.role) })}</span>
              <button className="btn sm" name="answer" value="accept">{t("chat.invites.accept")}</button>
              <button className="btn ghost sm" name="answer" value="decline">{t("chat.invites.decline")}</button>
            </form>
          ))}
        </section>
      )}
    <ChatClient
      key={`${current}-${focusId ?? ""}`}
      me={{ id: user.id, role: user.role }}
      channels={channels}
      tagTypes={tagTypes}
      current={current}
      initial={initial}
      focusId={focusId && initial.messages.some((m) => m.id === focusId) ? focusId : undefined}
      people={people}
      caps={{ canUpload: hasPermission(user.role, "chat.upload", ctx.matrix), canModerate: hasPermission(user.role, "chat.moderate", ctx.matrix), canCreateTf: hasPermission(user.role, "taskforce.create", ctx.matrix) }}
      limits={{ maxFiles: cfg.UPLOAD_MAX_FILES, maxImageMb: cfg.UPLOAD_MAX_IMAGE_MB, maxFileMb: cfg.UPLOAD_MAX_FILE_MB }}
    />
    </>
  );
}
