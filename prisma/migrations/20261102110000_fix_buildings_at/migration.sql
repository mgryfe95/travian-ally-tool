-- Fehler behoben: Rohstofffeld-Screenshots setzten "buildingsAt" (Gebäude) statt "resourcesAt".
-- "buildingsAt" neu bestimmen: jüngster Screenshot, der Gebäude übernommen hat; ohne solchen und ohne Gebäudedaten = nie (NULL);
-- ohne Screenshot, aber mit Gebäudedaten (manuell eingetragen) bleibt der Wert.
WITH b AS (
  SELECT (a->>'villageId')::int AS vid, max(s."createdAt") AS at
  FROM "Screenshot" s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.parsed->'applied') = 'array' THEN s.parsed->'applied' ELSE '[]'::jsonb END) a
  WHERE jsonb_typeof(a->'areas') = 'array' AND a->'areas' ? 'buildings'
  GROUP BY 1
)
UPDATE "VillageState" v SET "buildingsAt" = COALESCE(
  (SELECT b.at FROM b WHERE b.vid = v."villageId"),
  CASE WHEN v.buildings IS NULL OR jsonb_typeof(v.buildings) <> 'array' OR jsonb_array_length(v.buildings) = 0 THEN NULL ELSE v."buildingsAt" END
);
-- Rohstoffe: mindestens so aktuell wie der jüngste übernommene Rohstofffeld-Screenshot
WITH f AS (
  SELECT (a->>'villageId')::int AS vid, max(s."createdAt") AS at
  FROM "Screenshot" s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.parsed->'applied') = 'array' THEN s.parsed->'applied' ELSE '[]'::jsonb END) a
  WHERE jsonb_typeof(a->'areas') = 'array' AND a->'areas' ? 'fields'
  GROUP BY 1
)
UPDATE "VillageState" v SET "resourcesAt" = GREATEST(v."resourcesAt", f.at) FROM f WHERE f.vid = v."villageId";
