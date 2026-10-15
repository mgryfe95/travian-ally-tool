import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { AppError } from "../i18n/errors";
import type { MessageKey, Params } from "../i18n";

const run = promisify(execFile);

export class UploadError extends AppError {
  constructor(key: MessageKey, params?: Params, readonly status = 400) {
    super(key, params);
  }
}

export type UploadLimits = { maxImageBytes: number; maxFileBytes: number };

export type Processed = {
  kind: "image" | "pdf" | "text";
  mime: string;
  name: string;
  width?: number;
  height?: number;
  snippet?: string;
  /** Gespeicherte Dateien: Original (bei Bildern ohne Metadaten neu kodiert), Thumbnail (480 px), Web-Version (1920 px). */
  orig: Buffer;
  thumb?: Buffer;
  preview?: Buffer;
  origExt: string;
};

const IMAGE_MIMES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const TEXT_EXT: Record<string, string> = { ".txt": "text/plain", ".log": "text/plain", ".csv": "text/csv" };
const HTMLISH = /^\s*(<\?xml|<svg|<!doctype\s+html|<html|<script)/i;
const THUMB = 480;
const WEB = 1920;

const cleanName = (n: string) => path.basename(n).replace(/[^\w.\- äöüÄÖÜß()]/g, "_").slice(0, 120) || "datei";

async function processImage(data: Buffer, mime: string): Promise<Pick<Processed, "orig" | "thumb" | "preview" | "width" | "height">> {
  const base = () => sharp(data, { animated: mime === "image/gif", limitInputPixels: 80_000_000 }).rotate(); // rotate() wendet EXIF-Orientierung an
  const meta = await sharp(data, { limitInputPixels: 80_000_000 }).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = meta.info;
  // sharp schreibt standardmäßig keine EXIF/ICC/XMP-Metadaten → Original wird ohne Metadaten neu kodiert.
  const pipe = base();
  const orig =
    mime === "image/png" ? await pipe.png().toBuffer()
    : mime === "image/jpeg" ? await pipe.jpeg({ quality: 92 }).toBuffer()
    : mime === "image/webp" ? await pipe.webp({ quality: 92 }).toBuffer()
    : await pipe.gif().toBuffer();
  const still = sharp(data, { limitInputPixels: 80_000_000 }).rotate(); // erste Bildebene
  const thumb = await still.clone().resize({ width: THUMB, height: THUMB, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const preview = await still.clone().resize({ width: WEB, height: WEB, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  return { orig, thumb, preview, width, height };
}

async function pdfPreview(data: Buffer): Promise<{ thumb: Buffer; preview: Buffer } | undefined> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pdfprev-"));
  try {
    await writeFile(path.join(dir, "in.pdf"), data);
    await run("pdftoppm", ["-png", "-f", "1", "-l", "1", "-r", "110", path.join(dir, "in.pdf"), path.join(dir, "out")], { timeout: 20_000 });
    const png = (await readdir(dir)).find((f) => f.startsWith("out") && f.endsWith(".png"));
    if (!png) return undefined;
    const img = await readFile(path.join(dir, png));
    return {
      thumb: await sharp(img).resize({ width: THUMB, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      preview: await sharp(img).resize({ width: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
    };
  } catch {
    return undefined; // pdftoppm fehlt oder Datei nicht renderbar → Karte ohne Seitenvorschau
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function asText(data: Buffer): string | undefined {
  if (data.includes(0)) return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return undefined;
  }
}

/** Prüft per Inhalt (MIME-Sniffing), nicht per Endung, und erzeugt Vorschauen. */
export async function processUpload(input: { name: string; data: Buffer }, limits: UploadLimits): Promise<Processed> {
  const { data } = input;
  const name = cleanName(input.name);
  if (data.length === 0) throw new UploadError("err.upload.empty");
  const sniff = await fileTypeFromBuffer(data);

  if (sniff && IMAGE_MIMES[sniff.mime]) {
    if (data.length > limits.maxImageBytes) throw new UploadError("err.upload.imageTooBig", { mb: Math.round(limits.maxImageBytes / 1048576) }, 413);
    try {
      const img = await processImage(data, sniff.mime);
      return { kind: "image", mime: sniff.mime, name, origExt: IMAGE_MIMES[sniff.mime] as string, ...img };
    } catch {
      throw new UploadError("err.upload.imageUnreadable");
    }
  }
  if (sniff?.mime === "application/pdf") {
    if (data.length > limits.maxFileBytes) throw new UploadError("err.upload.fileTooBig", { mb: Math.round(limits.maxFileBytes / 1048576) }, 413);
    const prev = await pdfPreview(data);
    return { kind: "pdf", mime: "application/pdf", name, orig: data, origExt: "pdf", ...prev };
  }
  const ext = path.extname(name).toLowerCase();
  if (!sniff && TEXT_EXT[ext]) {
    if (data.length > limits.maxFileBytes) throw new UploadError("err.upload.fileTooBig", { mb: Math.round(limits.maxFileBytes / 1048576) }, 413);
    const text = asText(data);
    if (text === undefined) throw new UploadError("err.upload.notText");
    if (HTMLISH.test(text)) throw new UploadError("err.upload.html");
    return { kind: "text", mime: TEXT_EXT[ext] as string, name, orig: data, origExt: ext.slice(1), snippet: text.split("\n").slice(0, 20).join("\n").slice(0, 2000) };
  }
  throw new UploadError("err.upload.type", undefined, 415);
}
