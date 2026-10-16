import { describe, expect, it } from "vitest";
import { FallbackStorage, LocalStorage, S3Storage, type S3Like } from "./storage";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** In-Memory-„S3“: erkennt Befehle am Klassennamen. */
function fakeS3() {
  const objs = new Map<string, Buffer>();
  const client: S3Like = {
    async send(cmd: unknown) {
      const c = cmd as { constructor: { name: string }; input: { Key: string; Body?: Buffer } };
      const k = c.input.Key;
      switch (c.constructor.name) {
        case "PutObjectCommand": objs.set(k, c.input.Body!); return {};
        case "GetObjectCommand": { const b = objs.get(k); if (!b) throw new Error("NoSuchKey"); return { Body: { transformToByteArray: async () => new Uint8Array(b) } }; }
        case "HeadObjectCommand": if (!objs.has(k)) throw new Error("NotFound"); return {};
        case "DeleteObjectCommand": objs.delete(k); return {};
      }
      throw new Error("unexpected " + c.constructor.name);
    },
  };
  return { client, objs };
}

describe("S3Storage / FallbackStorage", () => {
  it("put/get/exists/delete und Schlüsselprüfung", async () => {
    const { client, objs } = fakeS3();
    const s = new S3Storage(client, "b");
    await s.put("shots/u/a.webp", Buffer.from("hi"));
    expect((await s.get("shots/u/a.webp")).toString()).toBe("hi");
    expect(await s.exists("shots/u/a.webp")).toBe(true);
    await s.delete("shots/u/a.webp");
    expect(objs.size).toBe(0);
    expect(await s.exists("shots/u/a.webp")).toBe(false);
    await expect(s.put("../evil", Buffer.from("x"))).rejects.toThrow();
  });
  it("Fallback: neue Dateien in S3, alte lokal lesbar, Löschen räumt beides", async () => {
    const { client, objs } = fakeS3();
    const local = new LocalStorage(mkdtempSync(path.join(os.tmpdir(), "st-")));
    await local.put("shots/u/old.webp", Buffer.from("old"));
    const s = new FallbackStorage(new S3Storage(client, "b"), local);
    await s.put("shots/u/new.webp", Buffer.from("new"));
    expect(objs.has("shots/u/new.webp")).toBe(true);
    expect(await local.exists("shots/u/new.webp")).toBe(false);
    expect((await s.get("shots/u/old.webp")).toString()).toBe("old");
    await s.delete("shots/u/old.webp");
    expect(await s.exists("shots/u/old.webp")).toBe(false);
  });
});
