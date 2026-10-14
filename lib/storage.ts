import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

/** Ablage für Anhänge. Lokal jetzt, später S3/MinIO hinter derselben Schnittstelle. */
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;

export class LocalStorage implements StorageAdapter {
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    if (!KEY_RE.test(key) || key.includes("..")) throw new Error("Ungültiger Storage-Key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Ungültiger Storage-Key");
    return full;
  }
  async put(key: string, data: Buffer) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }
  get(key: string) {
    return readFile(this.resolve(key));
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
  async exists(key: string) {
    return stat(this.resolve(key)).then(() => true, () => false);
  }
}

let cached: StorageAdapter | undefined;
export const storage = (): StorageAdapter => (cached ??= new LocalStorage(env().STORAGE_DIR));
