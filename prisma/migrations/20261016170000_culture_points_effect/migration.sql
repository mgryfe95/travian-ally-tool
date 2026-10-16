-- Kulturpunkte je Gebäudestufe als Vorteil (wie alle anderen) für Anzeige und Vergleich.
INSERT INTO "BuildingLevelEffect" ("buildingId","level","effect","value")
SELECT "buildingId", "level", 'culturePoints', "culturePoints" FROM "BuildingLevel"
ON CONFLICT DO NOTHING;
