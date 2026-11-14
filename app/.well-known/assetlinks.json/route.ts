import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Digital Asset Links: erlaubt der Android-App (TWA), das Tool ohne Browser-Adressleiste anzuzeigen. */
export function GET() {
  const fps = env().TWA_SHA256.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const body = fps.length ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: env().TWA_PACKAGE, sha256_cert_fingerprints: fps } }] : [];
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
