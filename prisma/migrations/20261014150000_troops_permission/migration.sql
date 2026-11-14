-- Neues Recht troops.view (Truppen aller Mitglieder einsehen): Moderator und Admin, nur wenn die Matrix schon geseedet ist
INSERT INTO "RolePermission" ("role", "permission")
SELECT r, 'troops.view' FROM (VALUES ('MODERATOR'), ('ADMIN')) AS v(r) WHERE EXISTS (SELECT 1 FROM "RolePermission")
ON CONFLICT DO NOTHING;
