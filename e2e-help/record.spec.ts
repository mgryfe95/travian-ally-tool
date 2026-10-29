import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { test, type Browser, type Locator, type Page } from "@playwright/test";

const OUT = path.join(process.cwd(), "public", "help");
const PW = "correct-horse-battery";
const SIZE = { width: 1280, height: 720 };

/** Beschriftungen der Oberfläche je Sprache (die Videos werden in beiden Sprachen aufgenommen). */
const L = {
  de: { locale: "de-DE", nav: "Hauptnavigation", overview: "Übersicht", chats: "Chats", deff: "# Deff-Call", message: "Nachricht", send: "Senden", reply: "Antworten", all: "Alle (Sammelraum)", ocr: "OCR-Scans", kind: "Art des Screenshots", inactive: "Inaktivensuche", search: "Suchen", admin: "Admin", invite: /Einladung erzeugen|Neuen Link erzeugen/, users: "Konten", rights: "Rechte", goal: "Dorftyp", incidents: "Incidents", manual: "Ohne Screenshot melden", attacker: /Angreifer: Spielername/, more: "Erwartest du weitere Angriffe?", yes: "Ja", save: "Incident speichern", text1: "Deff needed at (12|-34) in 2 h @Boss", text2: "Bin unterwegs" },
  en: { locale: "en-US", nav: "Main navigation", overview: "Overview", chats: "Chats", deff: "# Deff-Call", message: "Message", send: "Send", reply: "Reply", all: "All (collective room)", ocr: "OCR scans", kind: "Screenshot type", inactive: "Inactive search", search: "Search", admin: "Admin", invite: /Create invite|Create new link/, users: "Accounts", rights: "Permissions", goal: "Village type", incidents: "Incidents", manual: "Report without screenshot", attacker: /Attacker: player name/, more: "Do you expect more attacks?", yes: "Yes", save: "Save incident", text1: "Deff needed at (12|-34) in 2 h @Boss", text2: "On my way" },
};
type Lang = keyof typeof L;

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

async function session(browser: Browser, email: string, lang: Lang) {
  const ctx = await browser.newContext({ locale: L[lang].locale, viewport: SIZE, recordVideo: { dir: path.join("test-results-help", "raw"), size: SIZE } });
  const base = test.info().project.use.baseURL!;
  await ctx.request.post("/api/auth/sign-in/email", { data: { email, password: PW }, headers: { origin: base } });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForTimeout(600);
  return page;
}

async function save(page: Page, name: string, lang: Lang) {
  const video = page.video();
  await page.waitForTimeout(800);
  await page.context().close();
  mkdirSync(OUT, { recursive: true });
  if (video) await video.saveAs(path.join(OUT, `${name}.${lang}.webm`));
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
const nav = (page: Page, lang: Lang) => page.getByRole("navigation", { name: L[lang].nav });

for (const lang of Object.keys(L) as Lang[]) {
  const l = L[lang];

  test(`villages ${lang}`, async ({ browser }) => {
    const page = await session(browser, "member@example.com", lang);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(900);
    await page.mouse.wheel(0, -500);
    await click(page, nav(page, lang).getByRole("group", { name: l.overview }).getByRole("link").first());
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(600);
    const goal = page.getByLabel(l.goal);
    await click(page, goal);
    await goal.selectOption("HAMMER");
    await page.waitForTimeout(600);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(1200);
    await save(page, "villages", lang);
  });

  test(`chat ${lang}`, async ({ browser }) => {
    const page = await session(browser, "member@example.com", lang);
    await click(page, nav(page, lang).getByRole("link", { name: l.chats, exact: true }));
    await click(page, nav(page, lang).getByRole("link", { name: l.deff }));
    await type(page, page.getByLabel(l.message, { exact: true }), l.text1);
    await page.keyboard.press("Escape");
    await click(page, page.getByRole("button", { name: l.send }));
    await click(page, page.locator("article.msg").last().getByRole("button", { name: l.reply }));
    await type(page, page.getByLabel(l.message, { exact: true }), l.text2);
    await click(page, page.getByRole("button", { name: l.send }));
    await click(page, nav(page, lang).getByRole("link", { name: l.all }));
    await save(page, "chat", lang);
  });

  test(`ocr ${lang}`, async ({ browser }) => {
    const page = await session(browser, "member@example.com", lang);
    const box = page.locator("#upload");
    await box.scrollIntoViewIfNeeded();
    const kind = box.getByLabel(l.kind);
    await click(page, kind);
    await kind.selectOption("RESOURCE_VIEW");
    await page.waitForTimeout(1200);
    const png = await sharp({ create: { width: 320, height: 200, channels: 3, background: "#7a9a4a" } }).png().toBuffer();
    await click(page, box.locator("label.drop"));
    await box.locator("input[type=file]").setInputFiles({ name: "fields.png", mimeType: "image/png", buffer: png });
    await page.waitForTimeout(1500);
    await click(page, nav(page, lang).getByRole("link", { name: l.ocr }));
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(1200);
    await save(page, "ocr", lang);
  });

  test(`inactive ${lang}`, async ({ browser }) => {
    const page = await session(browser, "member@example.com", lang);
    await click(page, nav(page, lang).getByRole("link", { name: l.inactive }));
    await type(page, page.locator("#fmax"), "30");
    await click(page, page.locator("#fdays"));
    await page.locator("#fdays").selectOption({ index: 0 });
    await click(page, page.getByRole("button", { name: l.search }).first());
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(1500);
    await save(page, "inactive", lang);
  });

  test(`incidents ${lang}`, async ({ browser }) => {
    const page = await session(browser, "member@example.com", lang);
    await click(page, nav(page, lang).getByRole("link", { name: l.incidents }));
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(600);
    await click(page, page.getByRole("link", { name: l.manual }));
    await type(page, page.getByLabel(l.attacker), "(3|4)");
    await click(page, page.getByRole("group", { name: l.more }).getByLabel(l.yes));
    await click(page, page.getByRole("button", { name: l.save }));
    await page.waitForTimeout(1200);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(1200);
    await save(page, "incidents", lang);
  });

  test(`admin ${lang}`, async ({ browser }) => {
    const page = await session(browser, "boss@example.com", lang);
    await click(page, nav(page, lang).getByRole("link", { name: l.admin, exact: true }));
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(800);
    await click(page, page.getByRole("button", { name: l.invite }).first());
    await page.waitForTimeout(1500);
    await click(page, page.getByRole("tab", { name: l.users }));
    await click(page, page.getByRole("tab", { name: l.rights }));
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(1000);
    await save(page, "admin", lang);
  });
}
