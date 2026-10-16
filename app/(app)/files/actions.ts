"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { deleteOwnAttachment, deleteScreenshotFiles } from "@/lib/screenshots";
import { requireUser } from "@/lib/session";

export async function deleteFileAction(f: FormData) {
  const user = await requireUser();
  const id = Number(f.get("id"));
  if (Number.isInteger(id)) {
    if (f.get("type") === "screenshot") {
      const own = await db.screenshot.findFirst({ where: { id, userId: user.id }, select: { id: true } });
      if (own) await deleteScreenshotFiles(db, [id]);
    } else await deleteOwnAttachment(db, user.id, id);
  }
  redirect("/files");
}
