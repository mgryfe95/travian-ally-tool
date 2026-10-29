import { expect, test } from "@playwright/test";

test("Hilfe: ohne Login erreichbar, Filter, Quicklink über Anmeldung direkt zum Ziel", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "Admin-Funktionen" })).toBeVisible();
  await expect(page.getByText(/Du bist nicht angemeldet/)).toBeVisible();
  // Filter klappt passende Punkte auf und blendet andere aus
  await page.getByLabel("Hilfe durchsuchen").fill("Einladung erzeugen");
  await expect(page.getByRole("heading", { name: "Chat" })).toHaveCount(0);
  const item = page.locator("details#admin-invite");
  await expect(item).toHaveAttribute("open", "");
  await expect(item.getByText(/alle Spieler der Allianz-Gruppe laut Kartendaten/)).toBeVisible();
  // Quicklink führt ohne Login zur Anmeldung und danach auf den Admin-Reiter
  await item.getByRole("link", { name: /Mitglieder & Einladungen/ }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%3Ftab%3Dmembers/);
  await page.getByLabel("E-Mail").fill("boss@example.com");
  await page.getByLabel("Passwort").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL(/\/admin\?tab=members/);
  await expect(page.getByText(/Spieler in der Gruppe/).first()).toBeVisible();
  // angemeldet: Link direkt, Direktlink per #id öffnet den Punkt
  await page.goto("/help#inactive-filters");
  await expect(page.locator("details#inactive-filters")).toHaveAttribute("open", "");
  await expect(page.locator("details#inactive-filters").getByRole("link", { name: "Inaktivensuche" })).toHaveAttribute("href", "/inactive");
});

test("Hilfe auf Englisch (Browsersprache) mit allen Bereichen", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto("/help");
  for (const h of ["Getting started & account", "Overview & villages", "AI suggestions", "Incidents", "Chat", "OCR scans", "Inactive search", "Game data", "Admin features"]) {
    await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/You are not signed in/)).toBeVisible();
  // Kachel = Button; ein Klick zeigt nur diesen Bereich, „All topics“ wieder alle
  await page.getByRole("button", { name: /^Incidents/ }).click();
  await expect(page.getByRole("button", { name: /^Incidents/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Incidents", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/#sec-incidents$/);
  await page.getByRole("button", { name: /^OCR scans/ }).click();
  await expect(page.getByRole("figure", { name: "How your data flows" })).toBeVisible();
  await page.getByRole("button", { name: /^All topics/ }).click();
  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
  await ctx.close();
});

test("PDF-Übersicht ohne Login unter /help/pdf (Sprache per ?lang oder Browsersprache)", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto("/help");
  await expect(page.getByRole("link", { name: "Overview as PDF" })).toHaveAttribute("href", "/help/pdf?lang=en");
  const en = await ctx.request.get("/help/pdf");
  expect(en.status()).toBe(200);
  expect(en.headers()["content-type"]).toBe("application/pdf");
  expect(en.headers()["content-disposition"]).toContain("overview.en.pdf");
  expect((await en.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const de = await ctx.request.get("/help/pdf?lang=de");
  expect(de.headers()["content-disposition"]).toContain("overview.de.pdf");
  await ctx.close();
});
