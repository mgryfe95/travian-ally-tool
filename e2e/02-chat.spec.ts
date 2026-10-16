import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

const PW = "correct-horse-battery";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(PW);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test("Chat: Nachricht mit Tag in Deff-Call erscheint im Sammelraum; Screenshot einfügen → Vorschau → senden → Lightbox", async ({ page, browser }) => {
  // Konten boss (Systemadmin) und member stammen aus 01-invite.spec.ts.
  await login(page, "boss@example.com");

  await page.goto("/chat?c=all");
  await expect(page.getByRole("heading", { name: "Alle Kanäle" })).toBeVisible();
  // Im Sammelraum ist die Kanalwahl Pflicht; Deff-Call wählen und mit Tag senden.
  await page.locator("#chs").selectOption({ label: "Deff-Call" });
  await page.getByLabel("Kategorie", { exact: true }).selectOption({ label: "Dringend" });
  await page.getByLabel("Nachricht", { exact: true }).fill("Angriff auf (12|-34) in 2 h");
  await page.getByRole("button", { name: "Senden" }).click();
  const msg = page.locator("article.msg", { hasText: "Angriff auf" });
  await expect(msg).toBeVisible();
  await expect(msg.getByText("# Deff-Call")).toBeVisible();
  await expect(msg.locator(".pill", { hasText: "Dringend" })).toBeVisible();
  await expect(msg.getByRole("link", { name: "(12|-34)" })).toHaveAttribute("href", /karte\.php\?zoom=1&x=12&y=-34$/);
  // Persistenz: nach dem Neuladen steht die Nachricht noch im Chat.
  await page.reload();
  await expect(page.locator("article.msg", { hasText: "Angriff auf" })).toBeVisible();

  // Screenshot per Strg+V einfügen → Vorschau → senden → Lightbox.
  const png = await sharp({ create: { width: 640, height: 400, channels: 3, background: "#3a6" } }).png().toBuffer();
  await page.getByLabel("Nachricht", { exact: true }).evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "screenshot.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, png.toString("base64"));
  await expect(page.getByRole("button", { name: "Anhang screenshot.png entfernen" })).toBeVisible();
  await expect(page.getByLabel("Anhänge vor dem Senden").locator("img")).toHaveCSS("opacity", "1");
  await page.getByLabel("Nachricht", { exact: true }).fill("Hier der Bericht");
  await page.getByRole("button", { name: "Senden" }).click();
  const withImg = page.locator("article.msg", { hasText: "Hier der Bericht" });
  await withImg.getByRole("button", { name: /vergrößern/ }).click();
  const dialog = page.getByRole("dialog", { name: "Bildansicht" });
  await expect(dialog.getByRole("img")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Download" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Einzelner Kanal: Nachricht ist dort sichtbar; Tag-Filter blendet andere aus.
  await page.getByRole("link", { name: "# Deff-Call" }).click();
  await expect(page.getByRole("heading", { name: "# Deff-Call" })).toBeVisible();
  await expect(page.locator("article.msg")).toHaveCount(2);
  await page.getByRole("button", { name: "Dringend", exact: true }).click();
  await expect(page.locator("article.msg")).toHaveCount(1);

  // Ungeprüfter Zugriff: Anhang-URL ohne Anmeldung → 401; fremder Kontext → ebenfalls kein Zugriff.
  const anon = await browser.newContext({ locale: "de-DE" });
  const res = await anon.request.get("/api/attachments/1?v=thumb");
  expect(res.status()).toBe(401);
  await anon.close();
});

test("Task-Force-Kanal ist für Nicht-Mitglieder unsichtbar", async ({ page, browser }) => {
  await login(page, "boss@example.com");
  await page.goto("/chat/tf/new");
  await page.getByLabel("Name").fill("TF Südfront");
  await page.getByRole("button", { name: "Anlegen" }).click();
  await expect(page.getByRole("heading", { name: "TF Südfront" })).toBeVisible();
  await page.getByLabel("Nachricht", { exact: true }).fill("geheimer Plan");
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(page.locator("article.msg", { hasText: "geheimer Plan" })).toBeVisible();
  // Im Sammelraum taucht die Task-Force-Nachricht nicht auf.
  await page.goto("/chat?c=all");
  await expect(page.locator("article.msg", { hasText: "geheimer Plan" })).toHaveCount(0);

  // Der eingeladene Member (aus invite.spec) ist kein Mitglied → sieht die TF nicht.
  const ctx = await browser.newContext({ locale: "de-DE" });
  const m = await ctx.newPage();
  await login(m, "member@example.com");
  await m.goto("/chat?c=all");
  await expect(m.getByRole("link", { name: "TF Südfront" })).toHaveCount(0);
  // Direkter Aufruf der Verwaltungsseite: 404, nicht „kein Zugriff“ (die Task-Force existiert für ihn nicht).
  const resp = await m.goto("/chat/tf/1");
  expect(resp?.status()).toBe(404);
  await ctx.close();
});

test("Realtime: neue Nachricht erscheint live, Ungelesen-Zähler in anderen Kanälen", async ({ page, browser }) => {
  await login(page, "boss@example.com");
  const ctx = await browser.newContext({ locale: "de-DE" });
  const m = await ctx.newPage();
  await login(m, "member@example.com");
  await m.goto("/chat?c=all");
  await m.getByRole("link", { name: "# Off-Call" }).click();
  await expect(m.getByRole("heading", { name: "# Off-Call" })).toBeVisible();

  await page.goto("/chat?c=all");
  await page.getByRole("link", { name: "# Deff-Call" }).click();
  await expect(page.getByRole("heading", { name: "# Deff-Call" })).toBeVisible();
  await page.getByLabel("Nachricht", { exact: true }).fill("Live-Test eins");
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(page.locator("article.msg", { hasText: "Live-Test eins" })).toBeVisible();

  // Member ist in Off-Call: Badge am Deff-Call-Kanal (und am Sammelraum) ohne Neuladen.
  await expect(m.getByRole("link", { name: /# Deff-Call/ }).locator(".badge")).toBeVisible();
  await m.getByRole("link", { name: /# Deff-Call/ }).click();
  await expect(m.locator("article.msg", { hasText: "Live-Test eins" })).toBeVisible();

  await page.getByLabel("Nachricht", { exact: true }).fill("Live-Test zwei");
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(m.locator("article.msg", { hasText: "Live-Test zwei" })).toBeVisible({ timeout: 10_000 });
  await ctx.close();
});

test("Anhänge: Typ-/Größenprüfung beim Upload, Auslieferung nur mit Kanal-Leserecht, Security-Header", async ({ page, browser }) => {
  await login(page, "boss@example.com");
  const req = page.request;
  const upload = (name: string, buffer: Buffer, mimeType = "application/octet-stream") => req.post("/api/chat/upload", { multipart: { file: { name, mimeType, buffer } } });

  // Falsche Endung / ausführbarer Inhalt, SVG, zu großes Bild
  expect((await upload("evil.png", Buffer.from("MZ\x90\x00 not an image"), "image/png")).status()).toBe(415);
  expect((await upload("x.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/svg+xml")).status()).toBe(415);
  const huge = await sharp(randomBytes(2100 * 2100 * 3), { raw: { width: 2100, height: 2100, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  expect(huge.length).toBeGreaterThan(10 * 1_048_576);
  expect((await upload("huge.png", huge, "image/png")).status()).toBe(413);

  // Gültiges Bild in einer Task-Force-Nachricht
  const png = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#c33" } }).png().toBuffer();
  const up = await upload("geheim.png", png, "image/png");
  expect(up.status()).toBe(201);
  const attId = (await up.json()).attachments[0].id as number;
  // Vor dem Senden darf nur der Uploader die Datei sehen.
  const other = await browser.newContext({ locale: "de-DE" });
  const m = await other.newPage();
  await login(m, "member@example.com");
  expect((await m.request.get(`/api/attachments/${attId}?v=thumb`)).status()).toBe(403);

  await page.goto("/chat?tf=1");
  const tfHref = await page.getByRole("link", { name: "TF Südfront" }).first().getAttribute("href");
  const tfId = Number(new URL(tfHref!, "http://x").searchParams.get("c"));
  const post = await req.post("/api/chat/messages", { data: { channelId: tfId, body: "mit Bild", attachmentIds: [attId] } });
  expect(post.status()).toBe(201);

  const ok = await req.get(`/api/attachments/${attId}?v=thumb`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["x-content-type-options"]).toBe("nosniff");
  expect(ok.headers()["content-type"]).toBe("image/webp");
  expect(ok.headers()["content-security-policy"]).toContain("sandbox");
  // Member ist kein Mitglied der Task-Force → 403, auch für Original und Web-Version.
  for (const v of ["thumb", "web", "orig", "dl"]) expect((await m.request.get(`/api/attachments/${attId}?v=${v}`)).status()).toBe(403);
  // Lesen/Schreiben im TF-Kanal ebenfalls 403.
  expect((await m.request.get(`/api/chat/messages?channel=${tfId}`)).status()).toBe(403);
  expect((await m.request.post("/api/chat/messages", { data: { channelId: tfId, body: "hallo" } })).status()).toBe(403);
  // Original-Download: Bild wird ohne EXIF neu kodiert ausgeliefert, Text würde als Anhang geliefert.
  const orig = await req.get(`/api/attachments/${attId}?v=dl`);
  expect(orig.headers()["content-disposition"]).toContain("attachment");
  await other.close();
});
