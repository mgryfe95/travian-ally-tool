-- Volltextsuche: GIN-Ausdrucksindex (deutsch). Abfragen müssen denselben Ausdruck nutzen:
--   to_tsvector('german', "body") @@ plainto_tsquery('german', $1)
CREATE INDEX "Message_body_fts_idx" ON "Message" USING GIN (to_tsvector('german', "body"));

-- Gäste dürfen lesen (Kanäle bestimmen über minReadRole, wer wirklich etwas sieht); nur wenn die Matrix schon geseedet ist
INSERT INTO "RolePermission" ("role", "permission")
SELECT 'GUEST', 'chat.read' WHERE EXISTS (SELECT 1 FROM "RolePermission")
ON CONFLICT DO NOTHING;
