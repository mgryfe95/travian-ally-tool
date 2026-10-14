import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { VisionPipeline } from "@/lib/ai/pipeline";
import { processUpload } from "@/lib/chat/attachments";
import { uploadLimiter } from "@/lib/chat/limits";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { getOwnVillage, ownVillages } from "@/lib/services/villages";
import { getCurrentUser } from "@/lib/session";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Screenshot-Upload (Phase 2, Gerüst): speichert das Bild und startet die (Stub-)Pipeline. Ein Weg für alle Arten, Gerät/Art werden erkannt. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!uploadLimiter.check(`shot:${user.id}`)) return tooMany();
    if ((await ownVillages(db, user.id)).length === 0) return NextResponse.json({ error: "Dafür muss dein Konto mit einem Spieler verifiziert sein" }, { status: 403 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
    const villageRaw = form.get("villageId");
    const villageId = villageRaw ? Number(villageRaw) : undefined;
    if (villageId !== undefined && !(await getOwnVillage(db, user.id, villageId))) return NextResponse.json({ error: "Dieses Dorf gehört nicht zu deinem Konto" }, { status: 403 });

    const maxImageBytes = env().UPLOAD_MAX_IMAGE_MB * 1_048_576;
    const p = await processUpload({ name: file.name, data: Buffer.from(await file.arrayBuffer()) }, { maxImageBytes, maxFileBytes: maxImageBytes });
    if (p.kind !== "image") return NextResponse.json({ error: "Bitte einen Screenshot (PNG, JPG, WebP) hochladen" }, { status: 415 });
    const key = `shots/${user.id}/${randomUUID()}.${p.origExt}`;
    await storage().put(key, p.orig);
    const shot = await db.screenshot.create({ data: { userId: user.id, villageId: villageId ?? null, storageKey: key } });
    const result = await new VisionPipeline(db).process(shot.id);
    return NextResponse.json({ id: shot.id, status: result.status, message: result.reason ?? null }, { status: 201 });
  });
}
