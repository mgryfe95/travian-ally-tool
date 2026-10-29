import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { test, type Browser, type Locator, type Page } from "@playwright/test";

const OUT = path.join(process.cwd(), "public", "help");
const PW = "correct-horse-battery";
const SIZE = { width: 1280, height: 720 };

/** Sichtbarer Mauszeiger mit Klick-Ring (Playwright zeichnet den Cursor nicht ins Video). */
const CURSOR = `
addEventListener("DOMContentLoaded", () => {
  const c = document.createElement("div");
  c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(200,150,46,.85);border:2px solid #14253e;z-index:99999;pointer-events:none;transition:transform .12s";
  document.body.appendChild(c);
  addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => { c.style.transform = "scale(1.8)"; }, true);
  addEventListener("mouseup", () => { c.style.transform = "scale(1)"; }, true);
});`;

async function session(browser: Browser, email: string) {
  const ctx = await browser.newContext({ locale: "de-DE", viewport: SIZE, recordVideo: { dir: path.join("test-results-help", "raw"), size: SIZE } });
  const base = test.info().project.use.baseURL!;
  await ctx.request.post("/api/auth/sign-in/email", { data: { email, password: PW }, headers: { origin: base } });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  return { ctx, page };
}

async function save(page: Page, name: string) {
  const video = page.video();
  await page.waitForTimeout(800);
  await page.context().close();
  mkdirSync(OUT, { recursive: true });
  if (video) await video.saveAs(path.join(OUT, `${name}.webm`));
}

/** Maus sichtbar zum Element bewegen, kurz verweilen, klicken. */
async function click(page: Page, loc: Locator) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await page.waitForTimeout(300);
  await loc.click();
  await page.waitForTimeout(700);
}
async function type(page: Page, loc: Locator, text: string) {
  await click(page, loc);
  await loc.pressSequentially(text, { delay: 45 });
  await page.waitForTimeout(400);
}

test("Chat", async ({ browser }) => {
  const { page } = await session(browser, "member@example.com");
  await page.goto("/");
  await page.waitForTimeout(600);
  await click(page, page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Chats", exact: true }));
  await click(page, page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "# Deff-Call" }));
  await type(page, page.getByLabel("Nachricht", { exact: true }), "Deff needed at (12|-34) in 2 h @Boss");
  await page.keyboard.press("Escape");
  await click(page, page.getByRole("button", { name: "Senden" }));
  const msg = page.locator("article.msg").last();
  await click(page, msg.getByRole("button", { name: "Antworten" }));
  await type(page, page.getByLabel("Nachricht", { exact: true }), "On my way");
  await click(page, page.getByRole("button", { name: "Senden" }));
  await click(page, page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Alle (Sammelraum)" }));
  await save(page, "chat");
});

test("OCR-Scans", async ({ browser }) => {
  const { page } = await session(browser, "member@example.com");
  await page.goto("/");
  await page.waitForTimeout(600);
  const box = page.locator("#upload");
  await box.scrollIntoViewIfNeeded();
  const kind = box.getByLabel("Art des Screenshots");
  await click(page, kind);
  await kind.selectOption("RESOURCE_VIEW");
  await page.waitForTimeout(1200);
  const png = await sharp({ create: { width: 320, height: 200, channels: 3, background: "#7a9a4a" } }).png().toBuffer();
  await click(page, box.locator("label.drop"));
  await box.locator("input[type=file]").setInputFiles({ name: "felder.png", mimeType: "image/png", buffer: png });
  await page.waitForTimeout(1800);
  await click(page, page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "OCR-Scans" }));
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1200);
  await save(page, "ocr");
});

test("Inaktivensuche", async ({ browser }) => {
  const { page } = await session(browser, "member@example.com");
  await page.goto("/");
  await page.waitForTimeout(600);
  await click(page, page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Inaktivensuche" }));
  await type(page, page.locator("#fmax"), "30");
  await click(page, page.locator("#fdays"));
  await page.locator("#fdays").selectOption({ index: 0 });
  await click(page, page.getByRole("button", { name: "Suchen" }).first());
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1500);
  await save(page, "inactive");
});

test("Admin-Funktionen", async ({ browser }) => {
  const { page } = await session(browser, "boss@example.com");
  await page.goto("/");
  await page.waitForTimeout(600);
  await click(page, page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Admin", exact: true }));
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(800);
  const invite = page.getByRole("button", { name: /Einladung erzeugen|Neuen Link erzeugen/ }).first();
  await click(page, invite);
  await page.waitForTimeout(1500);
  await click(page, page.getByRole("tab", { name: "Konten" }));
  await click(page, page.getByRole("tab", { name: "Rechte" }));
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1000);
  await save(page, "admin");
});
