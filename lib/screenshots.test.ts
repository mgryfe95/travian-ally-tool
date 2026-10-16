import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compressScreenshot } from "./screenshots";

describe("compressScreenshot", () => {
  it("macht aus einem PNG-Screenshot eine deutlich kleinere WebP-Fassung in voller Auflösung plus Vorschau", async () => {
    const png = readFileSync(join(__dirname, "../tests/fixtures/screenshots/stats-resources-mobile-en.png"));
    const c = await compressScreenshot(png);
    expect(c.full.length).toBeLessThan(png.length * 0.5);
    expect(c.thumb.length).toBeLessThan(c.full.length);
    const meta = await sharp(c.full).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1080); // keine Verkleinerung unter 2600 px
    expect((await sharp(c.thumb).metadata()).width).toBeLessThanOrEqual(400);
    expect(meta.exif).toBeUndefined();
  });
});
