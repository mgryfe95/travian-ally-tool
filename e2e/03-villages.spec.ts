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
  // KI-Vorschläge: Bereich sichtbar, ohne API-Key gesperrt mit Hinweis
  await expect(page.getByRole("heading", { name: "KI-Vorschläge für deinen Account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "KI-Vorschläge aktualisieren" })).toBeDisabled();
  await expect(page.getByText("Auf diesem Server ist keine KI eingerichtet.").first()).toBeVisible();

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
  // Erst die Weiterleitung der Server-Action abwarten, sonst geht der folgende Upload in die alte Seite.
  await expect(page.getByRole("status").filter({ hasText: "Gespeichert" })).toBeVisible();
  await expect(page.getByLabel(/Was soll dieses Dorf werden/)).toHaveValue("Hammerdorf, keine Deff");

  // Screenshot hochladen (ein Weg, keine Geräte-Auswahl); Erkennung ist noch Stub
  const png = await sharp(randomBytes(300 * 200 * 3), { raw: { width: 300, height: 200, channels: 3 } }).png().toBuffer();
  await page.locator("#file-troops").setInputFiles({ name: "versammlungsplatz.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Gespeichert\. Screenshot-Erkennung/)).toBeVisible();

  // Truppen manuell eintragen (Hinweis auf Sichtbarkeit für Admins/Moderatoren)
  await expect(page.getByText(/Admins und Moderatoren können die Truppen deiner Dörfer/)).toBeVisible();
  await page.getByLabel(/Manuell eintragen/).fill("Axtkämpfer; 3.410; 600; 0\nKatapult; 120");
  await page.getByRole("button", { name: "Truppen speichern" }).click();
  await expect(page.getByRole("row", { name: /Axtkämpfer 3\.410 600/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Truppen", exact: true })).toHaveCount(0); // Member sieht den Menüpunkt nicht
  expect((await page.goto("/troops"))?.status()).toBe(200);
  await expect(page.getByText("Kein Zugriff")).toBeVisible();
  await page.goBack();

  // Advisor-Stub und Zugriffsschutz
  const villageId = Number(new URL(page.url()).pathname.split("/").pop());
  const advice = await page.request.post(`/api/advisor/village/${villageId}`);
  expect(advice.status()).toBe(200);
  expect((await advice.json()).recommendations).toEqual([]);

  const other = await browser.newContext({ locale: "de-DE" });
  const b = await other.newPage();
  await login(b, "boss@example.com"); // ohne verifizierten Spieler, aber Systemadmin
  // Systemadmin sieht die Truppen des Mitglieds in der Übersicht
  await b.getByRole("link", { name: "Admin", exact: true }).click(); // Truppen liegt im Admin-Untermenü
  await b.getByRole("link", { name: "Truppen", exact: true }).click();
  await expect(b.getByRole("heading", { name: "Truppen der Mitglieder" })).toBeVisible();
  await expect(b.getByRole("row", { name: /Axtkämpfer 3\.410/ }).first()).toBeVisible();
  await expect(b.getByText(/Jede Einsicht wird im Audit-Log vermerkt/)).toBeVisible();
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
