import { ChatClient } from "@/components/chat/ChatClient";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hasPermission } from "@/lib/permissions";
import { chatCtx, listChannels, listMessages } from "@/lib/services/chat";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string; tf?: string }> }) {
  const user = await requirePermission("chat.read");
  const sp = await searchParams;
  const ctx = await chatCtx(db, user);
  const channels = await listChannels(db, ctx);
  const tags = await db.tag.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, color: true } });

  const requested = sp.c === "all" ? "all" : Number(sp.c);
  const byId = Number.isInteger(requested) ? channels.find((c) => c.id === requested) : undefined;
  // Standard: Sammelraum; „Task-Forces“ aus der Navigation springt in die erste Task-Force.
  const current: number | "all" = sp.c === "all" ? "all" : byId ? byId.id : sp.tf ? (channels.find((c) => c.tree === "TASKFORCE")?.id ?? "all") : "all";
  const initial = await listMessages(db, ctx, { channelId: current });
  const cfg = env();

  return (
    <ChatClient
      key={String(current)}
      me={{ id: user.id, role: user.role }}
      channels={channels}
      tags={tags}
      current={current}
      initial={initial}
      caps={{ canUpload: hasPermission(user.role, "chat.upload", ctx.matrix), canModerate: hasPermission(user.role, "chat.moderate", ctx.matrix), canCreateTf: hasPermission(user.role, "taskforce.create", ctx.matrix) }}
      limits={{ maxFiles: cfg.UPLOAD_MAX_FILES, maxImageMb: cfg.UPLOAD_MAX_IMAGE_MB, maxFileMb: cfg.UPLOAD_MAX_FILE_MB }}
    />
  );
}
