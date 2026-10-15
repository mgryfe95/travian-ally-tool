import { defineConfig } from "@playwright/test";

const PORT = 3100;
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://ally:ally@localhost:5432/ally_e2e";
const chromium = process.env.PW_CHROMIUM ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : undefined);

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, locale: "de-DE", launchOptions: chromium ? { executablePath: chromium } : {} },
  webServer: {
    command: "npx prisma migrate deploy && npx next build && npx tsx server.ts",
    port: PORT,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "production", PORT: String(PORT), DATABASE_URL: DB, AUTH_SECRET: "e2e-secret-e2e-secret", APP_URL: `http://localhost:${PORT}`,
      SYSTEMADMIN_EMAILS: "boss@example.com", TRAVIAN_SERVER_URL: "https://ts12.x1.europe.travian.com", TRAVIAN_ALLIANCE_ID: "36", AUTH_RATE_LIMIT_PER_MIN: "1000",
    },
  },
});
