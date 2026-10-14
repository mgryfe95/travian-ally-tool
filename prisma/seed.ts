import { PrismaClient } from "@prisma/client";
import { seedPermissions } from "../lib/services/admin";

const prisma = new PrismaClient();

async function main() {
  // Idempotent. ALLY-Kanäle folgen mit M4.
  await seedPermissions(prisma);
  await prisma.setting.upsert({ where: { key: "schemaSeeded" }, update: {}, create: { key: "schemaSeeded", value: "1" } });
}

main().finally(() => prisma.$disconnect());
