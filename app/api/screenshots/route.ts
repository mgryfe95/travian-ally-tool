import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { reasonText, VisionPipeline } from "@/lib/ai/pipeline";
import { processUpload } from "@/lib/chat/attachments";
import { compressScreenshot } from "@/lib/screenshots";
import { uploadLimiter } from "@/lib/chat/limits";
import { db } from "@/lib/db";
import { assertQuota } from "@/lib/quota";
import { env } from "@/lib/env";
import { getLocale, getT } from "@/lib/i18n/server";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { getOwnVillage, ownVillages } from "@/lib/services/villages";
import { getCurrentUser } from "@/lib/session";
import { screenshotStorage } from "@/lib/storage";

export const runtime = "nodejs";

/** Screenshot-Upload (Phase 2, Gerüst): speichert das Bild und startet die (Stub-)Pipeline. Ein Weg für alle Arten, Gerät/Art werden erkannt. */
export function POST(req: Request) {
  return handle(async () => {
    const { t } = await getT();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!uploadLimiter.check(`shot:${user.id}`)) return tooMany();
    if ((await ownVillages(db, user.id)).length === 0) return NextResponse.json({ error: t("screenshots.err.needVerified") }, { status: 403 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: t("screenshots.err.noFile") }, { status: 400 });
    const villageRaw = form.get("villageId");
    const villageId = villageRaw ? Number(villageRaw) : undefined;
    if (villageId !== undefined && !(await getOwnVillage(db, user.id, villageId))) return NextResponse.json({ error: t("screenshots.err.notYourVillage") }, { status: 403 });

    const maxImageBytes = env().UPLOAD_MAX_IMAGE_MB * 1_048_576;
    const p = await processUpload({ name: file.name, data: Buffer.from(await file.arrayBuffer()) }, { maxImageBytes, maxFileBytes: maxImageBytes });
    if (p.kind !== "image") return NextResponse.json({ error: t("screenshots.err.notImage") }, { status: 415 });
    // Nur die komprimierte WebP-Fassung (ohne Metadaten) + Vorschau werden gespeichert, das Original nicht.
    const c = await compressScreenshot(p.orig);
    const base = `shots/${user.id}/${randomUUID()}`;
    await assertQuota(db, user.id, c.full.length + c.thumb.length);
    await screenshotStorage().put(`${base}.webp`, c.full);
    await screenshotStorage().put(`${base}.thumb.webp`, c.thumb);
    const shot = await db.screenshot.create({ data: { userId: user.id, villageId: villageId ?? null, storageKey: `${base}.webp`, thumbKey: `${base}.thumb.webp`, sizeBytes: c.full.length + c.thumb.length } });
    const result = await new VisionPipeline(db).process(shot.id);
    return NextResponse.json({ id: shot.id, status: result.status, message: reasonText(result, await getLocale()) }, { status: 201 });
  });
}
