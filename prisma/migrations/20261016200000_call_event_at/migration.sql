-- Termin (Angriff/Ereignis) getrennt vom Sendezeitpunkt
ALTER TABLE "AllianceCall" ADD COLUMN "eventAt" TIMESTAMP(3);
UPDATE "AllianceCall" SET "eventAt" = "at";
CREATE INDEX "AllianceCall_eventAt_idx" ON "AllianceCall"("eventAt");
