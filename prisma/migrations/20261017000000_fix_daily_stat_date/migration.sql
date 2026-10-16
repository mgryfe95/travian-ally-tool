-- Einmalige Korrektur: Tagesstände wurden unter dem UTC-Tag statt dem Tag der Spielserver-Uhr (Europe/Berlin) gespeichert,
-- ein Import um 0:10 landete so beim Vortag. Nur wenn bisher genau ein Tag existiert (Erstinstallation), wird er auf den Berliner Tag des letzten Imports gelegt.
DO $$
BEGIN
  IF (SELECT count(DISTINCT "date") FROM "PlayerDailyStat") = 1 THEN
    UPDATE "PlayerDailyStat"
    SET "date" = (SELECT (("fetchedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin')::date FROM "Snapshot" ORDER BY "id" DESC LIMIT 1);
  END IF;
END $$;
