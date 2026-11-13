import { stat } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

/** Signierte Android-App (TWA) liegt nach `scripts/build-apk.sh` unter STORAGE_DIR/app/. */
export const apkPath = () => path.resolve(env().STORAGE_DIR, "app", "travian-ally-tool.apk");

export async function apkInfo(): Promise<{ size: number; updatedAt: Date } | null> {
  try {
    const s = await stat(apkPath());
    return s.isFile() ? { size: s.size, updatedAt: s.mtime } : null;
  } catch {
    return null;
  }
}
