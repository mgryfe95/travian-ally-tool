import { NextResponse } from "next/server";
import { canReadChannel } from "@/lib/chat/access";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { handle, unauthorized } from "@/lib/http";
import { chatCtx } from "@/lib/services/chat";
import { getCurrentUser } from "@/lib/session";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Auslieferung nur nach Prüfung des Kanal-Leserechts der zugehörigen Nachricht (vor dem Senden: nur der Uploader). */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { t } = await getT();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const a = await db.attachment.findUnique({ where: { id: Number((await params).id) }, include: { message: { include: { channel: true } } } });
    const notFound = () => NextResponse.json({ error: t("screenshots.err.notFound") }, { status: 404 });
    if (!a) return notFound();
    if (a.message) {
      if (a.message.deletedAt || !canReadChannel(a.message.channel, await chatCtx(db, user))) return NextResponse.json({ error: t("screenshots.err.noAccess") }, { status: 403 });
    } else if (a.uploaderId !== user.id) return NextResponse.json({ error: t("screenshots.err.noAccess") }, { status: 403 });

    const v = new URL(req.url).searchParams.get("v") ?? "orig";
    const key = v === "thumb" ? a.thumbKey : v === "web" ? (a.previewKey ?? a.storageKey) : a.storageKey;
    if (!key) return notFound();
    const derived = (v === "thumb" && a.thumbKey) || (v === "web" && a.previewKey);
    const contentType = derived ? "image/webp" : a.mime.startsWith("text/") ? `${a.mime}; charset=utf-8` : a.mime;
    const inline = derived || a.kind === "image" || a.kind === "pdf";
    const data = await storage().get(key);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${inline && v !== "dl" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}
