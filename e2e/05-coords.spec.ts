import { expect, test } from "@playwright/test";

test("Koordinaten-Selektor: ±/+/−, Einfügen von (x|y), Suche nutzt x|y", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("boss@example.com");
  await page.getByLabel("Passwort").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/inactive");
  const x = page.locator("#cx-x"), y = page.locator("#cx-y");
  await x.focus();
  await x.evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData("text", "( −3 | −81 )");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(x).toHaveValue("-3");
  await expect(y).toHaveValue("-81");
  await page.getByRole("button", { name: "X plus 1" }).click();
  await expect(x).toHaveValue("-2");
  await page.getByRole("button", { name: /Vorzeichen von Y/ }).click();
  await expect(y).toHaveValue("81");
  await page.getByRole("button", { name: "Suchen" }).first().click().catch(() => undefined);
  await page.waitForLoadState();
  expect(decodeURIComponent(page.url())).toContain("origin=-2|81");
});
