import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test("Benachrichtigungen: Auswahl speichern, Manifest und Service Worker erreichbar", async ({ page, request }) => {
  await login(page, "member@example.com");
  await page.goto("/account/notifications");
  await expect(page.getByRole("heading", { name: "Benachrichtigungen", level: 1 })).toBeVisible();
  await expect(page.getByText(/VAPID-Schlüssel fehlen|unterstützt keine/)).toBeVisible();
  const deff = page.getByLabel("#Deff-Call");
  await expect(deff).not.toBeChecked();
  await deff.check();
  await page.getByLabel("Direktnachrichten").uncheck();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();
  await expect(page.getByLabel("#Deff-Call")).toBeChecked();
  await expect(page.getByLabel("Direktnachrichten")).not.toBeChecked();
  const m = await request.get("/manifest.webmanifest");
  expect((await m.json()).display).toBe("standalone");
  expect((await request.get("/sw.js")).ok()).toBe(true);
  expect(await (await request.get("/.well-known/assetlinks.json")).json()).toEqual([]);
});

test("KI-Bereich: Reiter Systemprompt und Wissen (RAG), /-Befehle im Chat", async ({ page }) => {
  await login(page, "member@example.com");
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "KI", exact: true }).click();
  await expect(page.getByRole("heading", { name: "KI-Assistent" })).toBeVisible();
  await page.getByRole("tab", { name: "Systemprompt" }).click();
  await page.getByLabel("Systemprompt").fill("Ich spiele defensiv.");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();
  await expect(page.getByLabel("Systemprompt")).toHaveValue("Ich spiele defensiv.");
  await page.getByRole("tab", { name: "Wissen (RAG)" }).click();
  await expect(page.getByText(/nur Volltextsuche/)).toBeVisible();
  await page.getByRole("tab", { name: "Chats" }).click();
  await page.getByRole("button", { name: "+ Neuer Chat" }).click();
  await expect(page).toHaveURL(/\/ai\?c=\d+/);
  const box = page.getByRole("textbox", { name: "Senden" });
  await box.fill("/");
  await expect(page.getByRole("listbox", { name: "Befehle" })).toBeVisible();
  await page.getByRole("button", { name: /\/help/ }).click();
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(page.locator("li.card", { hasText: "/search <Wörter>" })).toBeVisible();
});

test("App installieren: eigene Seite mit Web-App-Anleitung (Android, iOS) und APK-Hinweis, nur angemeldet", async ({ page }) => {
  await page.goto("/install");
  await expect(page).toHaveURL(/\/login/);
  await login(page, "member@example.com");
  await page.goto("/account/notifications");
  await page.getByRole("link", { name: /App installieren \(Android, iPhone, APK\)/ }).click();
  await expect(page.getByRole("heading", { name: "App installieren", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Warum die Web-App empfohlen ist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Android (Chrome)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /iPhone \/ iPad/ })).toBeVisible();
  await expect(page.getByText("Noch keine APK verfügbar – bitte die Web-App nutzen.")).toBeVisible();
});
