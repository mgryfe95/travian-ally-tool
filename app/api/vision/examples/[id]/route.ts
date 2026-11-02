import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { handle, unauthorized } from "@/lib/http";
import { deleteExample, ExampleError, updateExample } from "@/lib/screenshots";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

/** Lern-Beispiele korrigieren (PATCH) oder entfernen (DELETE): nur Ersteller und Admins. */
export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { t } = await getT();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const id = Number((await ctx.params).id);
    const b = (await req.json().catch(() => null)) as { reading?: unknown } | null;
    if (!Number.isInteger(id) || !b) return NextResponse.json({ error: t("screenshots.err.badRequest") }, { status: 400 });
    try {
      await updateExample(db, user.id, user.role === "ADMIN", id, b.reading);
    } catch (e) {
      if (e instanceof ExampleError) return NextResponse.json({ error: t(e.message === "invalid" ? "screenshots.err.badRequest" : "screenshots.err.notFound") }, { status: e.message === "invalid" ? 422 : 404 });
      throw e;
    }
    return NextResponse.json({ status: "updated" });
  });
}

export function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { t } = await getT();
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const id = Number((await ctx.params).id);
    try {
      await deleteExample(db, user.id, user.role === "ADMIN", id);
    } catch (e) {
      if (e instanceof ExampleError) return NextResponse.json({ error: t("screenshots.err.notFound") }, { status: 404 });
      throw e;
    }
    return NextResponse.json({ status: "deleted" });
  });
}
