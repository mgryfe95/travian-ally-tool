import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://ally:ally@localhost:5432/ally_e2e";

test("Gast mit verifizierter Zuordnung (Bündnispartner) kommt rein; ohne Verifizierung nur die Verifizierungsseite, ohne Weiterleitungsschleife", async ({ page }) => {
  const db = new PrismaClient({ datasources: { db: { url: DB } } });
  const user = await db.user.update({ where: { email: "member@example.com" }, data: { role: "GUEST" } });
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("member@example.com");
  await page.getByLabel("Passwort").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/chat/);
  // Ohne verifizierte Zuordnung: gesperrt bis zur Verifizierung
  await db.playerLink.updateMany({ where: { userId: user.id, status: "verified" }, data: { status: "pending" } });
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/claim$/);
  await db.playerLink.updateMany({ where: { userId: user.id, status: "pending" }, data: { status: "verified" } });
  await db.user.update({ where: { email: "member@example.com" }, data: { role: "MEMBER" } });
  await db.$disconnect();
});
