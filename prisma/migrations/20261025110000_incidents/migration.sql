ALTER TABLE "AdviceRun" ADD COLUMN "incidentId" INTEGER;

CREATE TABLE "Incident" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "villageId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "kind" TEXT NOT NULL,
  "attackerName" TEXT NOT NULL DEFAULT '',
  "attackerPlayerId" INTEGER,
  "attackerAlliance" TEXT NOT NULL DEFAULT '',
  "attackerX" INTEGER,
  "attackerY" INTEGER,
  "attackerUnits" JSONB,
  "attackerLosses" JSONB,
  "defenderLosses" JSONB,
  "answers" JSONB NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "screenshotId" INTEGER,
  "threatUntil" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "troopsCorrected" BOOLEAN NOT NULL DEFAULT false,
  "helpRequestedAt" TIMESTAMP(3),
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Incident_userId_status_idx" ON "Incident"("userId", "status");
CREATE INDEX "Incident_status_createdAt_idx" ON "Incident"("status", "createdAt");
