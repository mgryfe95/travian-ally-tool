import { NextResponse } from "next/server";
import { postLimiter } from "@/lib/chat/limits";
import { db } from "@/lib/db";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { chatCtx, deleteMessage, editMessage } from "@/lib/services/chat";
import { getCurrentUser } from "@/lib/session";

type P = { params: Promise<{ id: string }> };

export function PATCH(req: Request, { params }: P) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!postLimiter.check(user.id)) return tooMany();
    const b = (await req.json().catch(() => null)) as { body?: string } | null;
    if (typeof b?.body !== "string") return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    return NextResponse.json(await editMessage(db, await chatCtx(db, user), Number((await params).id), b.body));
  });
}

export function DELETE(_req: Request, { params }: P) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    await deleteMessage(db, await chatCtx(db, user), Number((await params).id));
    return NextResponse.json({ ok: true });
  });
}
