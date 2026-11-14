import { PrismaClient } from "@prisma/client";
import { seedPermissions } from "../lib/services/admin";
import { seedChat } from "../lib/services/chat";

const prisma = new PrismaClient();

async function main() {
  // Idempotent.
  await seedPermissions(prisma);
  await seedChat(prisma);
  await prisma.setting.upsert({ where: { key: "schemaSeeded" }, update: {}, create: { key: "schemaSeeded", value: "1" } });
}

main().finally(() => prisma.$disconnect());
