# Entwickler-Doku

- `app/` Next.js App Router · `server.ts` Custom Node Server (Next + Socket.IO) · `worker/` Cron-Worker (eigener Container, gleiches Image)
- `lib/env.ts` validiert ENV (zod); `SYSTEMADMIN_EMAILS` wird zu Liste normalisiert.
- `prisma/` Schema, Migrationen, Seed (idempotent). `Setting` hält Admin-UI-Overrides der ENV-Defaults.
- Lokal: Postgres 16 starten, `.env` aus `.env.example` (IMPORT_CRON in Anführungszeichen, wenn per Shell gesourct), `npx prisma migrate dev`, `npm run dev`.
- Tests: `npm run ci`. DB-Integrationstests (Test-DB via Docker) folgen mit M2/M3.
- Offen: M2 ist blockiert, bis das echte map.sql-Spaltenformat verifiziert ist (Sandbox-Netz blockiert den Travian-Host).
- Produktiv-Domain: `humans-travian.com` (APP_URL=https://humans-travian.com; Reverse-Proxy/TLS auf dem VPS vor `app:3000`, WebSocket-Upgrade für `/socket.io` durchreichen).

## M2 — map.sql (Format verifiziert an echter Datei)
- 16 Spalten: `fieldId,x,y,tribe,villageId,villageName,playerId,playerName,allianceId,allianceName,population` + `region,isCapital,isCity,hasHarbor,victoryPoints` (Zusatzspalten landen in `extra` jsonb; unbekannte weitere als `colN`). `isCapital` ist plausibel (13 684 TRUE = 13 684 Spieler), `region/isCity/hasHarbor/victoryPoints` sind auf diesem Server durchgehend NULL.
- Keine Escapes in den echten Daten (Apostrophe werden vom Server ersetzt, z. B. `´`/Backtick); der Parser kann trotzdem `''` und `\'`.
- Völker auf dem Server: 1 Römer, 2 Germanen, 3 Gallier, 5 Natars (6/7/8 vorgesehen).
- Karte: -200..200, Wrap-Größe 401 (`lib/geo.ts`). `fieldId = (200-y)*401 + (x+200) + 1`.
- Allianz „Human“ hat `allianceId=36` (180 Dörfer) → empfohlen `TRAVIAN_ALLIANCE_ID=36`.
- Status (`lib/analytics.ts`): inactive ≥ INACTIVE_DAYS Snapshots ohne Zuwachs · declining bei Rückgang · stagnant 1..N-1 Tage · active sonst. Snapshot = Tagesaggregat (`PlayerDailyStat`); mehrere Importe am selben Tag überschreiben den Tageswert.
- Erstimport erzeugt keine Events. Erste „Inaktive“ gibt es frühestens nach INACTIVE_DAYS+1 Tagesständen.
- Manuell importieren: `npx tsx scripts/import-file.ts <map.sql>` (Dauer real ≈ 6 s).
- Integrationstests nutzen `TEST_DATABASE_URL` (Default `postgresql://ally:ally@localhost:5432/ally_test`, wird per `prisma migrate deploy` angelegt).
- Offen für M3: Ursprung per Dropdown aus „Meine Dörfer“ und „zuletzt gewählten Ursprung merken“ (braucht Login/PlayerLink).

## Allianz-Gruppe (eigene Gruppe)
- Tabelle `AllianceClassification(allianceId, relation, note, updatedBy)` — bewusst ohne FK, weil `Alliance` bei jedem Import neu aufgebaut wird.
- Typen: `OWN` (Eigene Allianz), `ALLIED` (Allianz), `NAP`, `NEUTRAL`, `ENEMY`. **Eigene Gruppe = OWN ∪ ALLIED** (`lib/alliance-group.ts`). Die konfigurierte `TRAVIAN_ALLIANCE_ID` / Setting `allianceId` ist implizit OWN; ein expliziter Eintrag überschreibt das.
- Überall, wo „eigene Allianz“ gemeint ist (Einladungsliste, Dorf-Umbenennungs-Beweis „Spieler ist in der eigenen Allianz“, Austritts-Markierung, Mitgliederabgleich), gilt die Gruppe, nie nur die Einzel-ID.
- Abgleich `compareMembers(groupPlayers, links)`: Mitglieder mit/ohne verifizierten Account, ausstehende Links, verifizierte Accounts außerhalb der Gruppe (`orphanLinks`, nur Markierung).
- Setzen bis zum Admin-UI: `npx tsx scripts/set-alliance-relation.ts 36 OWN` bzw. `... 7 ALLIED`.
