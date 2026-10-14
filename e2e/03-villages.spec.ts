import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const PW = "correct-horse-battery";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(PW);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test("Meine Dörfer: Übersicht, KI-Instruktionen, Erinnerungen, Upload, Zugriff nur auf eigene Dörfer", async ({ page, browser }) => {
  // member ist mit einem Spieler der Gruppe verifiziert (aus 01-invite.spec.ts).
  await login(page, "member@example.com");
  await expect(page.getByRole("heading", { name: /Deine \d+ (Dorf|Dörfer)/ })).toBeVisible();

  // Account-Instruktionen speichern (prominent oben)
  await page.getByLabel(/dorfübergreifende Strategie/).fill("Off-Account, Hammerdorf im Hauptdorf");
  await page.getByRole("button", { name: "Speichern" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Gespeichert" })).toBeVisible();
  await expect(page.getByLabel(/dorfübergreifende Strategie/)).toHaveValue("Off-Account, Hammerdorf im Hauptdorf");

  // Noch nie aktualisiert → Erinnerungen mit Direktlink zum Upload
  const due = page.locator("section", { hasText: "Aktualisierungen fällig" });
  await expect(due.getByText("noch nie").first()).toBeVisible();
  await due.getByRole("link", { name: "Versammlungsplatz hochladen" }).first().click();
  await page.waitForURL(/\/villages\/\d+/);

  // Dorf-Dashboard: Account-Text read-only sichtbar, Dorf-Text speichern
  await expect(page.getByText("Off-Account, Hammerdorf im Hauptdorf")).toBeVisible();
  await page.getByLabel(/Was soll dieses Dorf werden/).fill("Hammerdorf, keine Deff");
  await page.locator("#desc").getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByLabel(/Was soll dieses Dorf werden/)).toHaveValue("Hammerdorf, keine Deff");

  // Screenshot hochladen (ein Weg, keine Geräte-Auswahl); Erkennung ist noch Stub
  const png = await sharp(randomBytes(300 * 200 * 3), { raw: { width: 300, height: 200, channels: 3 } }).png().toBuffer();
  await page.locator("#file-troops").setInputFiles({ name: "versammlungsplatz.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Gespeichert\. Automatische Erkennung noch nicht aktiv/)).toBeVisible();

  // Advisor-Stub und Zugriffsschutz
  const villageId = Number(new URL(page.url()).pathname.split("/").pop());
  const advice = await page.request.post(`/api/advisor/village/${villageId}`);
  expect(advice.status()).toBe(200);
  expect((await advice.json()).recommendations).toEqual([]);

  const other = await browser.newContext();
  const b = await other.newPage();
  await login(b, "boss@example.com"); // ohne verifizierten Spieler
  const resp = await b.goto(`/villages/${villageId}`);
  expect(resp?.status()).toBe(404);
  expect((await b.request.post(`/api/advisor/village/${villageId}`)).status()).toBe(404);
  const shot = await b.request.post("/api/screenshots", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: png } } });
  expect(shot.status()).toBe(403);
  await b.goto("/");
  await expect(b.getByRole("heading", { name: "Noch kein Spieler verknüpft" })).toBeVisible();
  await other.close();
});

test("Spieldaten: Leerzustand bis zum freigegebenen Import", async ({ page }) => {
  await login(page, "member@example.com");
  await page.goto("/gamedata");
  await expect(page.getByRole("heading", { name: "Spieldaten" })).toBeVisible();
  await expect(page.getByText(/Noch keine Spieldaten/)).toBeVisible();
  for (const tab of ["Gebäude", "Truppen", "Völker"]) await expect(page.getByRole("tab", { name: tab })).toBeVisible();
});
