import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts", "lib/**/*.test.ts"], environment: "node", env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://ally:ally@localhost:5432/ally_test",
      AUTH_SECRET: "test-secret-test-secret",
      TRAVIAN_SERVER_URL: "https://ts12.x1.europe.travian.com",
      SYSTEMADMIN_EMAILS: "boss@example.com",
      APP_URL: "http://localhost:3000",
    },
    globalSetup: ["./tests/global-setup.ts"], fileParallelism: false, testTimeout: 30_000 },
});
