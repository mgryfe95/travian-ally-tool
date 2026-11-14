-- Gast = verifizierter enger Bündnispartner (vorher: unverifiziert ohne Rechte). Standardrechte nur setzen, wenn für GUEST noch nichts eingetragen ist.
INSERT INTO "RolePermission" ("role", "permission")
SELECT 'GUEST', p FROM unnest(ARRAY['map.view', 'chat.read', 'chat.write', 'schedule.view', 'messenger.use']) AS p
WHERE NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'GUEST')
  AND EXISTS (SELECT 1 FROM "RolePermission");
