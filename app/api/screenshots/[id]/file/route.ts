import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { handle, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { screenshotStorage } from "@/lib/storage";

export const runtime = "nodejs";

/** Screenshot oder Vorschau ausliefern – nur an den Uploader (und Admins). */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { t } = await getT();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const s = await db.screenshot.findUnique({ where: { id: Number((await params).id) } });
    if (!s || s.removedAt || (s.userId !== user.id && user.role !== "ADMIN")) return NextResponse.json({ error: t("screenshots.err.notFound") }, { status: 404 });
    const thumb = new URL(req.url).searchParams.get("v") === "thumb";
    const key = thumb ? (s.thumbKey ?? s.storageKey) : s.storageKey;
    const data = await screenshotStorage().get(key);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": "image/webp", "Content-Length": String(data.length), "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": "private, max-age=3600" },
    });
  });
}
