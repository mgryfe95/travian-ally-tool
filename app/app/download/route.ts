import { readFile } from "node:fs/promises";
import { apkInfo, apkPath } from "@/lib/app-apk";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** APK nur für angemeldete Nutzer (die App selbst ist nur ein Rahmen um das Web-Tool). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  if (!(await apkInfo())) return new Response("not found", { status: 404 });
  return new Response(await readFile(apkPath()), {
    headers: { "content-type": "application/vnd.android.package-archive", "content-disposition": 'attachment; filename="travian-ally-tool.apk"', "cache-control": "no-store" },
  });
}
