import { NextResponse } from "next/server";
import { postLimiter } from "@/lib/chat/limits";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { handle, tooMany, unauthorized } from "@/lib/http";
import { chatCtx, listMessages, postMessage } from "@/lib/services/chat";
import { getCurrentUser } from "@/lib/session";

const int = (v: string | null) => (v && Number.isInteger(Number(v)) ? Number(v) : undefined);

export function GET(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const sp = new URL(req.url).searchParams;
    const c = sp.get("channel");
    const channelId = c === "all" ? "all" : int(c);
    if (channelId === undefined) return NextResponse.json({ error: (await getT()).t("chat.api.channelMissing") }, { status: 400 });
    const res = await listMessages(db, await chatCtx(db, user), { channelId, before: int(sp.get("before")), tagId: int(sp.get("tag")), q: sp.get("q") ?? undefined, limit: int(sp.get("limit")) });
    return NextResponse.json(res);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!postLimiter.check(user.id)) return tooMany();
    const b = (await req.json().catch(() => null)) as { channelId?: number; body?: string; tagIds?: number[]; attachmentIds?: number[] } | null;
    if (!b || typeof b.channelId !== "number" || typeof b.body !== "string") return NextResponse.json({ error: (await getT()).t("chat.api.invalidRequest") }, { status: 400 });
    const msg = await postMessage(db, await chatCtx(db, user), {
      channelId: b.channelId, body: b.body, tagIds: Array.isArray(b.tagIds) ? b.tagIds.filter(Number.isInteger) : [], attachmentIds: Array.isArray(b.attachmentIds) ? b.attachmentIds.filter(Number.isInteger) : [],
    });
    return NextResponse.json(msg, { status: 201 });
  });
}
