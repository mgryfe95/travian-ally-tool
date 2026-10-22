import { expect, test } from "@playwright/test";

test("Mein Konto: Link im Profil, eigene Adresse, ohne SMTP Hinweis statt Reset-Knopf", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("boss@example.com");
  await page.getByLabel("Passwort").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Mein Konto" }).click();
  await expect(page.getByRole("heading", { name: "Mein Konto" })).toBeVisible();
  await expect(page.getByText("boss@example.com")).toBeVisible();
  await expect(page.getByText(/E-Mail-Versand ist auf diesem Server nicht eingerichtet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Link per E-Mail senden" })).toHaveCount(0);
});
