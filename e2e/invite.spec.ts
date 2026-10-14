import { expect, test } from "@playwright/test";

const PW = "correct-horse-battery";

test("Einladung erzeugen → einlösen → verifiziert; Systemadmin bleibt unantastbar", async ({ page, browser }) => {
  // Systemadmin registriert sich (Setup-Code = AUTH_SECRET).
  await page.goto("/register");
  await page.getByPlaceholder("Anzeigename").fill("Boss");
  await page.getByPlaceholder("E-Mail").fill("boss@example.com");
  await page.getByPlaceholder(/Passwort/).fill(PW);
  await page.getByText("Setup-Code").click();
  await page.locator('input[name="setupCode"]').fill("e2e-secret-e2e-secret");
  await page.getByRole("button", { name: "Registrieren" }).click();
  await page.waitForURL("**/account");
  await expect(page.getByText("Rolle SYSTEMADMIN")).toBeVisible();

  // Einladung für ein Mitglied der Gruppe (Allianz 36 laut ENV) erzeugen.
  await page.goto("/admin/members");
  await expect(page.getByText(/Spieler in der Gruppe/)).toBeVisible();
  await page.getByRole("button", { name: "Einladung" }).first().click();
  const text = await page.locator("textarea").first().inputValue();
  expect(text).toContain("Einladungslink");
  const url = text.match(/https?:\/\/\S+\/invite\/\S+/)![0];

  // Als neuer Nutzer in frischem Kontext einlösen.
  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  await guest.goto(url);
  await guest.getByPlaceholder("E-Mail").fill("member@example.com");
  await guest.getByPlaceholder(/Passwort/).fill(PW);
  await guest.getByRole("button", { name: /Konto erstellen/ }).click();
  await guest.waitForURL("**/account");
  await expect(guest.getByText("Rolle MEMBER")).toBeVisible();
  await expect(guest.getByText("verifiziert").first()).toBeVisible();
  // Link ist einmalig.
  await guest.goto(url);
  await expect(guest.getByText("Einladung ungültig")).toBeVisible();
  // Member hat keinen Zugriff auf Admin.
  await guest.goto("/admin/members");
  await expect(guest.getByText("Kein Zugriff")).toBeVisible();
  await ctx.close();

  // Abgleich zeigt jetzt ein Konto; Systemadmin-Zeile ist nicht änderbar.
  await page.goto("/admin/members");
  await expect(page.getByText(/Spieler in der Gruppe/)).toContainText(/\b1 mit verifiziertem Konto/);
  await page.goto("/admin/users");
  const bossRow = page.locator("tr", { hasText: "boss@example.com" });
  await expect(bossRow.getByRole("button")).toHaveCount(0);
});
