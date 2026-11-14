ALTER TABLE "VillageProfile" ADD COLUMN "goal" TEXT;

CREATE TABLE "AiUsage" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  "feature" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

CREATE TABLE "AdviceRun" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trigger" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "errorKey" TEXT,
  "summary" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "AdviceRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdviceRun_userId_createdAt_idx" ON "AdviceRun"("userId", "createdAt");

CREATE TABLE "Recommendation" (
  "id" SERIAL NOT NULL,
  "runId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "villageId" INTEGER,
  "type" TEXT NOT NULL,
  "priority" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Recommendation_userId_status_idx" ON "Recommendation"("userId", "status");
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdviceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Neue Rechte: Mitglieder und Moderatoren dürfen KI-Vorschläge und Incidents nutzen. Alle Incidents sehen nur Admins (incidents.view, freigebbar).
-- Gäste bekommen sie nicht – Admins können sie in der Rechte-Matrix freigeben. Nur wenn die Matrix schon geseedet ist.
INSERT INTO "RolePermission" ("role", "permission")
SELECT r.role, r.permission FROM (VALUES ('MEMBER', 'ai.advice'), ('MEMBER', 'incidents.report'), ('MODERATOR', 'ai.advice'), ('MODERATOR', 'incidents.report')) AS r(role, permission)
WHERE EXISTS (SELECT 1 FROM "RolePermission")
ON CONFLICT DO NOTHING;
