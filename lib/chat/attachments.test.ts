import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processUpload, UploadError } from "./attachments";

const limits = { maxImageBytes: 200_000, maxFileBytes: 400_000 };
const png = (w = 40, h = 30) => sharp({ create: { width: w, height: h, channels: 3, background: "#d9a441" } }).png().toBuffer();
const reject = async (p: Promise<unknown>, status?: number) => {
  try {
    await p;
  } catch (e) {
    return e instanceof UploadError && (status === undefined || e.status === status);
  }
  return false;
};

const PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF\n",
);

describe("processUpload", () => {
  it("PNG: Maße, Thumbnail ≤ 480 px und Web-Version", async () => {
    const r = await processUpload({ name: "a.png", data: await png(1000, 600) }, { ...limits, maxImageBytes: 5_000_000 });
    expect(r).toMatchObject({ kind: "image", mime: "image/png", width: 1000, height: 600 });
    expect((await sharp(r.thumb).metadata()).width).toBe(480);
    expect((await sharp(r.preview).metadata()).width).toBe(1000);
  });
  it("entfernt EXIF-Metadaten (z. B. Copyright/GPS-Block)", async () => {
    const withExif = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } }).jpeg().withExif({ IFD0: { Copyright: "geheim" } }).toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const r = await processUpload({ name: "foto.jpg", data: withExif }, limits);
    expect((await sharp(r.orig).metadata()).exif).toBeUndefined();
    expect(r.orig.includes(Buffer.from("geheim"))).toBe(false);
  });
  it("wendet EXIF-Orientierung an (Breite/Höhe vertauscht bei 90°)", async () => {
    const jpg = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#fff" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const r = await processUpload({ name: "o.jpg", data: jpg }, limits);
    expect([r.width, r.height]).toEqual([20, 40]);
  });
  it("Typ wird per Inhalt geprüft: PNG mit .txt-Endung ist ein Bild, EXE mit .png ist abgelehnt", async () => {
    expect((await processUpload({ name: "x.txt", data: await png() }, limits)).kind).toBe("image");
    expect(await reject(processUpload({ name: "x.png", data: Buffer.from("MZ\x90\x00\x03\x00\x00\x00 not an image at all") }, limits), 415)).toBe(true);
  });
  it("SVG und HTML sind nicht erlaubt (auch als .txt getarnt)", async () => {
    expect(await reject(processUpload({ name: "a.svg", data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') }, limits))).toBe(true);
    expect(await reject(processUpload({ name: "a.txt", data: Buffer.from("<html><script>alert(1)</script></html>") }, limits))).toBe(true);
    expect(await reject(processUpload({ name: "a.html", data: Buffer.from("<html></html>") }, limits), 415)).toBe(true);
  });
  it("Größenlimits: Bild und sonstige Dateien getrennt", async () => {
    const big = await sharp(randomBytes(800 * 800 * 3), { raw: { width: 800, height: 800, channels: 3 } }).png().toBuffer();
    expect(big.length).toBeGreaterThan(200_000);
    expect(await reject(processUpload({ name: "big.png", data: big }, limits), 413)).toBe(true);
    expect(await reject(processUpload({ name: "big.txt", data: Buffer.alloc(500_000, "a") }, limits), 413)).toBe(true);
  });
  it("Text/CSV/LOG: erste 20 Zeilen als Snippet", async () => {
    const text = Array.from({ length: 50 }, (_, i) => `zeile ${i + 1}`).join("\n");
    const r = await processUpload({ name: "log.log", data: Buffer.from(text) }, limits);
    expect(r).toMatchObject({ kind: "text", mime: "text/plain" });
    expect(r.snippet?.split("\n")).toHaveLength(20);
    expect((await processUpload({ name: "t.csv", data: Buffer.from("a,b\n1,2") }, limits)).mime).toBe("text/csv");
  });
  it("Binärdaten als .txt und leere Dateien werden abgelehnt", async () => {
    expect(await reject(processUpload({ name: "a.txt", data: Buffer.from([0, 1, 2, 3, 0, 255]) }, limits))).toBe(true);
    expect(await reject(processUpload({ name: "a.txt", data: Buffer.alloc(0) }, limits))).toBe(true);
  });
  it("PDF: erkannt, Seite 1 als Vorschau (falls pdftoppm vorhanden)", async () => {
    const r = await processUpload({ name: "plan.pdf", data: PDF }, limits);
    expect(r).toMatchObject({ kind: "pdf", mime: "application/pdf" });
    if (r.thumb) expect((await sharp(r.thumb).metadata()).format).toBe("webp");
  });
  it("Dateiname wird bereinigt", async () => {
    expect((await processUpload({ name: "../../etc/pass wd?.txt", data: Buffer.from("x") }, limits)).name).toBe("pass wd_.txt");
  });
});
