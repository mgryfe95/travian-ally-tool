import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://ally:ally@localhost:5432/ally_e2e";

test("Gesperrtes Konto mit verifiziertem Link: keine Weiterleitungsschleife, Hinweis auf der Verifizierungsseite", async ({ page }) => {
  const db = new PrismaClient({ datasources: { db: { url: DB } } });
  await db.user.update({ where: { email: "member@example.com" }, data: { role: "GUEST" } });
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("member@example.com");
  await page.getByLabel("Passwort").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/claim");
  await expect(page.getByRole("status").filter({ hasText: "bereits verknüpft" })).toBeVisible();
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/claim$/);
  await db.user.update({ where: { email: "member@example.com" }, data: { role: "MEMBER" } });
  await db.$disconnect();
});
