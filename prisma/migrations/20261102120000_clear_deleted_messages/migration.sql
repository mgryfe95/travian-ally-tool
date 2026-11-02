-- DSGVO: Text bereits gelöschter Nachrichten leeren (die Zeile bleibt für Antworten/Moderation)
UPDATE "Message" SET "body" = '' WHERE "deletedAt" IS NOT NULL AND "body" <> '';
