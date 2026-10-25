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
  await page.getByLabel("Art").selectOption("raid");
  await page.getByLabel(/Angreifer: Spielername/).fill("Raider42");
  await page.getByLabel(/Deine Verluste/).fill("Keulenschwinger; 10");
  await page.getByRole("group", { name: "Erwartest du weitere Angriffe?" }).getByLabel("Ja").check();
  await page.getByRole("button", { name: "Incident speichern" }).click();
  await expect(page.getByRole("heading", { name: /Incident auf/ })).toBeVisible();
  await expect(page.getByText("Raider42")).toBeVisible();
  await expect(page.getByText(/10 Keulenschwinger/)).toBeVisible();
  await page.getByRole("button", { name: "Hilfe im Deff-Call anfragen" }).click();
  await expect(page.getByText(/Hilfe angefragt am/)).toBeVisible();
  await page.goto("/incidents");
  await page.getByRole("search").getByRole("textbox").fill("Raider42");
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page.getByRole("link", { name: /raid on .* by Raider42/ }).first()).toBeVisible();
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
