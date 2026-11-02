ALTER TABLE "Building" ADD COLUMN "nameEn" TEXT;
-- Bestand: der englische Name stand bisher in der Beschreibung („EN: …“)
UPDATE "Building" SET "nameEn" = substring("description" from '^EN: (.*)$') WHERE "description" LIKE 'EN: %';
