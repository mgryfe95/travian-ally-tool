# Changelog (append-only)

## 2026-10-14 · travian-ally-tool/core/m1-geruest
Was & Warum: M1 Gerüst — Next.js 15 (App Router, strict), Tailwind, Prisma + erste Migration/Seed, Custom Server mit Socket.IO, Worker-Stub (node-cron), Health-Endpoint, Docker Compose (app/worker/db), `npm run ci`, Vitest. Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-14 · travian-ally-tool/core/m2-mapsql
Was & Warum: M2 map.sql-Import und Auswertung. Parser (verifiziert an echter map.sql von ts12.x1.europe: 23 611 Zeilen, 16 Spalten, Zusatzspalten 11–15 = region, isCapital, isCity, hasHarbor, victoryPoints), Importer mit SHA-256-Skip, Snapshot/VillageSnapshot/Player/Alliance/Village/PlayerDailyStat/Event, Status- und Delta-Berechnung, Event-Diff, Distanz mit Kartenwrap (401er Torus), Seiten Inaktive/Spieler/Allianz/Ereignisse. Worker importiert beim Start und per Cron.

## 2026-10-14 · travian-ally-tool/core/alliance-group
Was & Warum: Dringende Ergänzung — mehrere Allianzen gelten intern als eine. Allianzen bekommen einen Typ (`AllianceClassification`: OWN „Eigene Allianz“, ALLIED „Allianz“, NAP, NEUTRAL, ENEMY). OWN + ALLIED bilden die „eigene Gruppe“. Abgleich „Mitglieder im System“ vs. „Mitglieder der Gruppe“ in `compareMembers`; Inaktiven-Suche blendet die Gruppe standardmäßig aus. Admin-UI zum Setzen folgt mit M3 (Recht `alliances.classify`).

## 2026-10-14 · travian-ally-tool/core/m3-accounts
Was & Warum: M3 Accounts, Rollen, Verifizierung. Better Auth (E-Mail + Passwort mit argon2id, DB-Sessions, Rate-Limit), Rollen SYSTEMADMIN (nur ENV) > ADMIN > MODERATOR > MEMBER > GUEST, editierbare Rechte-Matrix mit geseedeten Defaults, harte SYSTEMADMIN-Schutzregeln (serverseitig, getestet → 403), PlayerLink/Invite (nur Hash gespeichert)/Dorf-Umbenennungs-Code/manuelle Freigabe, Audit-Log, Admin-UI (Allianzen/Allianz-Gruppe, Mitglieder & Abgleich, Nutzer, Rechte, Audit), `/login`, `/register`, `/invite/[token]`, `/account`. Seiten der Karte verlangen `map.view`. Playwright-E2E für Einladung → Einlösen → verifiziert.
