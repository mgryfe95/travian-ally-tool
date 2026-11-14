import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test("Beta-Feedback: Admin schaltet Tester frei; Rechtsklick kommentiert ein Element, Unterhaltung, schließen, Filter, Export", async ({ page, browser }) => {
  // Mitglied ohne Beta-Kennzeichen sieht nichts
  const mctx = await browser.newContext({ locale: "de-DE" });
  const m = await mctx.newPage();
  await login(m, "member@example.com");
  await expect(m.getByRole("button", { name: /Beta-Feedback/ })).toHaveCount(0);

  // Admin macht das Mitglied zum Beta-Tester
  await login(page, "boss@example.com");
  await page.goto("/admin?tab=users");
  await page.getByRole("row", { name: /TDQ/ }).getByRole("button", { name: "Zum Beta-Tester machen" }).click();
  await expect(page.getByRole("row", { name: /TDQ/ }).getByText("Beta-Tester")).toBeVisible();

  // Rechtsklick auf die Überschrift → Kommentar anlegen
  await m.reload();
  await expect(m.getByRole("button", { name: /Beta-Feedback \(\d+ offen\)/ })).toBeVisible();
  await m.getByRole("heading", { level: 1 }).click({ button: "right" });
  const pop = m.getByRole("dialog", { name: "Kommentare zu diesem Element" });
  await expect(pop.getByText("Noch keine Kommentare zu diesem Element.")).toBeVisible();
  await pop.getByLabel("Neuer Kommentar zu diesem Element").fill("Überschrift etwas größer?");
  await pop.getByRole("button", { name: "Kommentieren" }).click();
  await expect(pop.getByText("Überschrift etwas größer?")).toBeVisible();
  await expect(m.getByRole("button", { name: "1 offene Kommentare – anzeigen" })).toBeVisible();

  // Antwort und schließen
  await pop.getByLabel("Antworten").fill("Notiert.");
  await pop.getByRole("button", { name: "Senden" }).click();
  await expect(pop.getByText("Notiert.")).toBeVisible();
  await pop.getByRole("button", { name: "Thread schließen" }).click();
  await expect(pop.getByRole("button", { name: "Wieder öffnen" })).toBeVisible();
  await pop.getByRole("button", { name: "Schließen" }).first().click();

  // Panel: Filter offen/geschlossen, Export
  await m.getByRole("button", { name: /Beta-Feedback/ }).click();
  const panel = m.getByRole("region", { name: "Beta-Feedback" });
  await expect(panel.getByText("Keine Kommentare für diesen Filter.")).toBeVisible();
  await panel.getByLabel("Nach Status filtern").selectOption("closed");
  await expect(panel.getByText("Überschrift etwas größer?")).toBeVisible();
  const href = await panel.getByRole("link", { name: "JSON exportieren" }).getAttribute("href");
  const exp = await m.request.get(href!);
  expect(exp.headers()["content-disposition"]).toContain("beta-feedback-closed");
  const data = (await exp.json()) as { threads: { comments: { body: string }[]; selector: string }[] };
  expect(data.threads[0]!.comments.map((c) => c.body)).toEqual(["Überschrift etwas größer?", "Notiert."]);
  expect(data.threads[0]!.selector).toContain("h1");

  // Umschalt+Rechtsklick lässt das normale Menü in Ruhe (kein Popover)
  await m.getByRole("heading", { level: 1 }).click({ button: "right", modifiers: ["Shift"] });
  await expect(pop).toHaveCount(0);
  await mctx.close();
});
