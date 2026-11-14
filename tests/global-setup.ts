import { execSync } from "node:child_process";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://ally:ally@localhost:5432/ally_test";

export default function setup() {
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: TEST_DB_URL } });
  process.env.TEST_DATABASE_URL = TEST_DB_URL;
}
