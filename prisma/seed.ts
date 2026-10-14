import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Idempotent. Spätere Meilensteine ergänzen: Rollen-Rechte (M3), ALLY-Kanäle (M4).
  await prisma.setting.upsert({ where: { key: "schemaSeeded" }, update: {}, create: { key: "schemaSeeded", value: "1" } });
}

main().finally(() => prisma.$disconnect());
