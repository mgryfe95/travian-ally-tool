-- Bestandskonten gelten als bestätigt, damit das neue E-Mail-Kriterium (aktiv sobald SMTP konfiguriert ist) niemanden aussperrt.
UPDATE "User" SET "emailVerified" = true WHERE "emailVerified" = false;
