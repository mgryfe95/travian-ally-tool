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
