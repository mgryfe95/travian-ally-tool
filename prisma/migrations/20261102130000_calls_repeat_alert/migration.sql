-- Calls: Wiederholung und Erinnerung; Incident: automatischer System-Call „Angriff melden“
ALTER TABLE "AllianceCall" ADD COLUMN "repeat" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AllianceCall" ADD COLUMN "repeatUntil" TIMESTAMP(3);
ALTER TABLE "AllianceCall" ADD COLUMN "remindMin" INTEGER;
ALTER TABLE "AllianceCall" ADD COLUMN "remindedAt" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN "alertCallId" INTEGER;
-- Vorlage für den System-Call (bestehende Installationen; neue bekommen sie über den Seed), Kanal Deff-Call
INSERT INTO "CallTemplate" ("kind", "name", "body", "bodyEn", "channelId", "sortOrder", "sendDm")
SELECT 'ALERT', 'Angriff melden',
  E'🚨 **Angriff gemeldet** auf **{spieler}** – {dorf} {koordinaten}\n{notiz}',
  E'🚨 **Attack reported** on **{player}** – {village} {coords}\n{note}',
  (SELECT "id" FROM "Channel" WHERE "tree" = 'ALLY' AND "slug" = 'deff-call' AND "archivedAt" IS NULL LIMIT 1), 90, false
WHERE EXISTS (SELECT 1 FROM "CallTemplate") AND NOT EXISTS (SELECT 1 FROM "CallTemplate" WHERE "kind" = 'ALERT' OR "name" = 'Angriff melden');
-- Kalender für alle sichtbar: Leserecht für Gäste und Mitglieder sicherstellen
INSERT INTO "RolePermission" ("role", "permission")
SELECT r, 'schedule.view' FROM unnest(ARRAY['GUEST', 'MEMBER', 'MODERATOR']) AS r
WHERE NOT EXISTS (SELECT 1 FROM "RolePermission" rp WHERE rp."role" = r AND rp."permission" = 'schedule.view');
