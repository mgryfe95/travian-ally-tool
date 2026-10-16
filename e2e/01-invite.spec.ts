import { expect, test } from "@playwright/test";

const PW = "correct-horse-battery";

test("Einladung erzeugen → einlösen → verifiziert; Systemadmin bleibt unantastbar", async ({ page, browser }) => {
  // Systemadmin registriert sich (Setup-Code = AUTH_SECRET) und landet bei der Spieler-Verknüpfung.
  await page.goto("/register");
  await page.getByLabel("Anzeigename (optional)").fill("Boss");
  await page.getByLabel("E-Mail").fill("boss@example.com");
  await page.getByLabel("Passwort", { exact: true }).fill(PW);
  await page.getByLabel("Passwort wiederholen").fill(PW);
  await page.getByText("Setup-Code").click();
  await page.getByLabel("Setup-Code").fill("e2e-secret-e2e-secret");
  await page.getByRole("button", { name: "Account erstellen" }).click();
  await page.waitForURL((u) => u.pathname === "/"); // Admin-Konto braucht keine Verifizierung (/claim leitet weiter)
  await expect(page.locator(".me")).toContainText("Admin");

  // Einladung für ein Mitglied der Gruppe (Allianz 36 laut ENV) erzeugen.
  await page.goto("/admin?tab=members");
  await expect(page.getByText(/Spieler in der Gruppe/).first()).toBeVisible();
  await page.getByRole("button", { name: "Einladung erzeugen" }).first().click();
  const text = await page.locator("textarea").first().inputValue();
  expect(text).toContain("Einladungslink");
  const url = text.match(/https?:\/\/\S+\/invite\/\S+/)![0];

  // Als neuer Nutzer in frischem Kontext einlösen.
  const ctx = await browser.newContext({ locale: "de-DE" });
  const guest = await ctx.newPage();
  await guest.goto(url);
  await expect(guest.getByRole("heading", { name: /Willkommen,/ })).toBeVisible();
  await guest.getByLabel("E-Mail").fill("member@example.com");
  await guest.getByLabel("Passwort", { exact: true }).fill(PW);
  await guest.getByLabel("Passwort wiederholen").fill("anders-anders-anders");
  await guest.getByRole("button", { name: "Account erstellen" }).click();
  await expect(guest.getByText("Die Passwörter stimmen nicht überein")).toBeVisible();
  await guest.getByLabel("Passwort wiederholen").fill(PW);
  await guest.getByRole("button", { name: "Account erstellen" }).click();
  await guest.waitForURL((u) => u.pathname === "/");
  await expect(guest.locator(".me")).toContainText("Mitglied");
  // Link ist einmalig.
  await guest.goto(url);
  await expect(guest.getByText("Einladung ungültig")).toBeVisible();
  // Verifizierter Member braucht /claim nicht mehr und hat keinen Zugriff auf Admin.
  await guest.goto("/claim");
  await guest.waitForURL((u) => u.pathname === "/");
  await guest.goto("/admin");
  await expect(guest.getByText("Kein Zugriff")).toBeVisible();
  await guest.goto("/inactive");
  await expect(guest.getByRole("heading", { name: "Inaktive in deiner Nähe" })).toBeVisible();
  await ctx.close();

  // Abgleich zeigt jetzt ein Konto; Systemadmin-Zeile ist nicht änderbar.
  await page.goto("/admin?tab=members");
  await expect(page.getByText(/Spieler in der Gruppe/).first()).toContainText(/1 mit verifiziertem Konto/);
  await expect(page.locator(".pill", { hasText: "Einladung ✓" })).toHaveCount(1);
  await page.goto("/admin?tab=users");
  const bossRow = page.locator("tr", { hasText: "Boss" });
  await expect(bossRow).toContainText("🔒 Admin");
  await expect(bossRow.getByRole("button", { name: /Sperren|Löschen/ })).toHaveCount(0);
});
