import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { processUpload, UploadError } from "@/lib/chat/attachments";
import { uploadLimiter } from "@/lib/chat/limits";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { ForbiddenError, hasPermission } from "@/lib/permissions";
import { chatCtx } from "@/lib/services/chat";
import { getCurrentUser } from "@/lib/session";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Upload vor dem Senden: erzeugt Attachment-Zeilen ohne Nachricht; die Nachricht referenziert danach die IDs. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const ctx = await chatCtx(db, user);
    if (!hasPermission(ctx.role, "chat.upload", ctx.matrix)) throw new ForbiddenError("err.perm.missing", { perm: "chat.upload" });
    if (!uploadLimiter.check(user.id)) return tooMany();
    const cfg = env();
    const limits = { maxImageBytes: cfg.UPLOAD_MAX_IMAGE_MB * 1_048_576, maxFileBytes: cfg.UPLOAD_MAX_FILE_MB * 1_048_576 };
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > limits.maxFileBytes * cfg.UPLOAD_MAX_FILES + 1_048_576) throw new UploadError("err.upload.requestTooBig", undefined, 413);
    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new UploadError("err.upload.noFile");
    if (files.length > cfg.UPLOAD_MAX_FILES) throw new UploadError("err.upload.maxFiles", { max: cfg.UPLOAD_MAX_FILES });

    const out = [];
    for (const file of files) {
      const p = await processUpload({ name: file.name, data: Buffer.from(await file.arrayBuffer()) }, limits);
      const base = `att/${new Date().getUTCFullYear()}/${randomUUID()}`;
      const keys = { storageKey: `${base}/orig.${p.origExt}`, thumbKey: p.thumb ? `${base}/thumb.webp` : null, previewKey: p.preview ? `${base}/preview.webp` : null };
      await storage().put(keys.storageKey, p.orig);
      if (p.thumb && keys.thumbKey) await storage().put(keys.thumbKey, p.thumb);
      if (p.preview && keys.previewKey) await storage().put(keys.previewKey, p.preview);
      const a = await db.attachment.create({
        data: { uploaderId: user.id, kind: p.kind, mime: p.mime, name: p.name, sizeBytes: p.orig.length, width: p.width, height: p.height, snippet: p.snippet, ...keys },
      });
      out.push({ id: a.id, kind: a.kind, name: a.name, sizeBytes: a.sizeBytes, width: a.width, height: a.height, hasThumb: !!a.thumbKey });
    }
    return NextResponse.json({ attachments: out }, { status: 201 });
  });
}
