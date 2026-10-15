import { NextResponse } from "next/server";
import { z } from "zod";
import { VisionPipeline } from "@/lib/ai/pipeline";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { handle, unauthorized } from "@/lib/http";
import { deleteScreenshotFiles } from "@/lib/screenshots";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const body = z.object({ action: z.enum(["confirm", "reject", "delete"]), reading: z.unknown().optional(), villageId: z.number().int().optional() });

/** Prüfen eines Screenshots (Lernmodus): bestätigen (optional mit Korrektur) oder verwerfen. Nur der eigene Upload. */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { t } = await getT();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const id = Number((await ctx.params).id);
    const b = body.safeParse(await req.json().catch(() => null));
    if (!Number.isInteger(id) || !b.success) return NextResponse.json({ error: t("screenshots.err.badRequest") }, { status: 400 });
    const shot = await db.screenshot.findUnique({ where: { id } });
    if (!shot || shot.userId !== user.id) return NextResponse.json({ error: t("screenshots.err.notFound") }, { status: 404 });
    if (b.data.action === "delete") {
      await deleteScreenshotFiles(db, [id]);
      return NextResponse.json({ status: "deleted" });
    }
    if (b.data.action === "reject") {
      await db.screenshot.update({ where: { id }, data: { status: "rejected" } });
      return NextResponse.json({ status: "rejected" });
    }
    const r = await new VisionPipeline(db).confirm(id, user.id, b.data.reading, b.data.villageId);
    return NextResponse.json({ status: r.status, message: r.reason ?? null }, { status: r.status === "failed" ? 422 : 200 });
  });
}
