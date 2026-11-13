import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test("Incidents: Erklärung, manuell melden, Hilfe im Deff-Call, Admin sieht offene Incidents", async ({ page, browser }) => {
  await login(page, "member@example.com");
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Incidents" }).click();
  await expect(page.getByRole("heading", { name: "Was ist ein Incident?" })).toBeVisible();
  await page.getByRole("link", { name: "Ohne Screenshot melden" }).click();
  await page.getByLabel("Was ist passiert?").selectOption("defense");
  await page.getByLabel("Beschreibe es in eigenen Worten").fill("Raubzug heute Nacht, 10 Keulenschwinger verloren");
  await page.getByRole("button", { name: "Weiter zur Klärung" }).click();
  // Klärungs-Chat (ohne KI: regelbasiert)
  await expect(page).toHaveURL(/\/ai\?c=\d+/);
  await expect(page.getByText("Incident-Klärung").first()).toBeVisible();
  await expect(page.getByText(/Wer war der Angreifer/)).toBeVisible();
  const box = page.getByRole("textbox", { name: "Senden" });
  const items = page.locator("main ol > li");
  for (const answer of ["Raider42", "ja", "nein", "nein", "nein"]) {
    const n = await items.count();
    await box.fill(answer);
    await page.getByRole("button", { name: "Senden" }).click();
    await expect(items).toHaveCount(n + 2);
    await expect(page.getByRole("button", { name: "Senden" })).toBeEnabled();
  }
  await expect(page.getByText(/Incident gespeichert/)).toBeVisible();
  await page.getByRole("link", { name: "Incident öffnen" }).click();
  await expect(page.getByRole("heading", { name: /Incident auf/ })).toBeVisible();
  await expect(page.getByText("Raider42").first()).toBeVisible();
  await expect(page.getByText(/10 Keulenschwinger verloren/)).toBeVisible();
  await page.getByRole("button", { name: "Hilfe im Deff-Call anfragen" }).click();
  await expect(page.getByText(/Hilfe angefragt am/)).toBeVisible();
  await page.goto("/incidents");
  await page.getByRole("search").getByRole("textbox").fill("Raider42");
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page.getByRole("link", { name: /defense\/attack on .* by Raider42/ }).first()).toBeVisible();
  await page.goto("/chat");
  await page.getByRole("complementary", { name: "Kanäle" }).getByRole("link", { name: "# Deff-Call" }).click();
  await expect(page.locator("article.msg", { hasText: "Defence needed" }).first()).toBeVisible();

  const other = await browser.newContext({ locale: "de-DE" });
  const b = await other.newPage();
  await login(b, "boss@example.com");
  await b.goto("/incidents");
  const all = b.getByRole("region", { name: "Alle offenen Incidents der Allianz" });
  await expect(all.getByRole("row", { name: /Raider42/ }).first()).toBeVisible();
  await other.close();
});
