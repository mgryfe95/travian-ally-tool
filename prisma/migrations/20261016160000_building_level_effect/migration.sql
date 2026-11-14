CREATE TABLE "BuildingLevelEffect" (
    "buildingId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "effect" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "BuildingLevelEffect_pkey" PRIMARY KEY ("buildingId","level","effect")
);
CREATE INDEX "BuildingLevelEffect_effect_idx" ON "BuildingLevelEffect"("effect");
ALTER TABLE "BuildingLevelEffect" ADD CONSTRAINT "BuildingLevelEffect_buildingId_level_fkey" FOREIGN KEY ("buildingId","level") REFERENCES "BuildingLevel"("buildingId","level") ON DELETE CASCADE ON UPDATE CASCADE;
-- bereits importierte Daten übernehmen (nur Zahlenwerte)
INSERT INTO "BuildingLevelEffect" ("buildingId","level","effect","value")
SELECT bl."buildingId", bl."level", e.key, (e.value)::text::double precision
FROM "BuildingLevel" bl, LATERAL jsonb_each(bl."effects") e
WHERE jsonb_typeof(e.value) = 'number';
