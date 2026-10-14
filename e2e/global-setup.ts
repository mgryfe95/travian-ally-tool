import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { importMapSql } from "../lib/import/importer";
import { seedPermissions } from "../lib/services/admin";

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://ally:ally@localhost:5432/ally_e2e";
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
  const db = new PrismaClient({ datasources: { db: { url } } });
  await db.$executeRawUnsafe(
    'TRUNCATE "User","Invite","PlayerLink","AuditLog","AllianceClassification","Setting","Player","Village","Alliance","Snapshot","PlayerDailyStat","Event","RolePermission" RESTART IDENTITY CASCADE',
  );
  await seedPermissions(db);
  await importMapSql(db, readFileSync("tests/fixtures/map.sample.sql", "utf8"), { inactiveDays: 3 });
  await db.$disconnect();
}
