import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";
import { AppError } from "./i18n/errors";

/** Ablage für Dateien: lokal (Docker-Volume) oder S3-kompatibel hinter derselben Schnittstelle. */
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
    if (!KEY_RE.test(key) || key.includes("..")) throw new AppError("err.storage.invalidKey");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new AppError("err.storage.invalidKey");
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

let cachedLocal: StorageAdapter | undefined;
/** Lokale Ablage (Docker-Volume) – Fallback für Dateien von vor der S3-Umstellung. */
export const localStorage = (): StorageAdapter => (cachedLocal ??= new LocalStorage(env().STORAGE_DIR));

let cachedS3: S3Storage | null | undefined;
function s3(): S3Storage | null {
  if (cachedS3 !== undefined) return cachedS3;
  const e = env();
  if (!e.S3_BUCKET_SCREENSHOTS) return (cachedS3 = null);
  const client = new S3Client({
    region: e.S3_REGION, endpoint: e.S3_ENDPOINT, forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY } : undefined,
  });
  return (cachedS3 = new S3Storage(client, e.S3_BUCKET_SCREENSHOTS));
}

let cached: StorageAdapter | undefined;
/** Chat- und Nachrichten-Anhänge: S3, sobald konfiguriert (alte lokale Dateien bleiben lesbar), sonst lokal. */
export const storage = (): StorageAdapter => {
  if (cached) return cached;
  const bucket = s3();
  return (cached = bucket ? new FallbackStorage(bucket, localStorage()) : localStorage());
};

/** Minimaler Teil des S3-Clients (für Tests austauschbar). */
export type S3Like = { send(command: unknown): Promise<unknown> };

/** S3-kompatibler Speicher (ein Bucket, Schlüssel wie lokal). Auslieferung läuft weiter über die geprüften App-Routen – der Bucket bleibt privat. */
export class S3Storage implements StorageAdapter {
  constructor(private readonly client: S3Like, private readonly bucket: string) {}

  private key(key: string) {
    if (!KEY_RE.test(key) || key.includes("..")) throw new AppError("err.storage.invalidKey");
    return key;
  }
  async put(key: string, data: Buffer) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.key(key), Body: data, ContentType: key.endsWith(".webp") ? "image/webp" : "application/octet-stream" }));
  }
  async get(key: string) {
    const r = (await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) }))) as { Body?: { transformToByteArray(): Promise<Uint8Array> } };
    if (!r.Body) throw new AppError("err.storage.invalidKey");
    return Buffer.from(await r.Body.transformToByteArray());
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(key) }));
  }
  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(key) }));
      return true;
    } catch {
      return false;
    }
  }
}

/** Neue Dateien nur in `primary`; Lesen/Löschen fällt auf `legacy` zurück (vor der S3-Umstellung lokal gespeicherte Screenshots). */
export class FallbackStorage implements StorageAdapter {
  constructor(private readonly primary: StorageAdapter, private readonly legacy: StorageAdapter) {}
  put(key: string, data: Buffer) {
    return this.primary.put(key, data);
  }
  async get(key: string) {
    return (await this.primary.exists(key)) ? this.primary.get(key) : this.legacy.get(key);
  }
  async delete(key: string) {
    await this.primary.delete(key);
    await this.legacy.delete(key);
  }
  async exists(key: string) {
    return (await this.primary.exists(key)) || this.legacy.exists(key);
  }
}

/** Screenshots: derselbe private Bucket wie Anhänge (Schlüssel `shots/…`), sonst lokal. */
export const screenshotStorage = (): StorageAdapter => storage();
