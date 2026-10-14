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

## M3 — Auth, Rollen, Verifizierung
- **Auth:** Better Auth 1.7 (`lib/auth.ts`), Prisma-Adapter, DB-Sessions, argon2id (`@node-rs/argon2`). `.npmrc` setzt `legacy-peer-deps` (optionale Peers von better-auth kollidieren mit vite 5 aus vitest 2).
- **Registrierung nur über `/api/register`** (`lib/services/register.ts`): Better Auth `/sign-up/email` ist per Hook ohne internen Header gesperrt; Rolle/`banned` sind `input:false`. Rate-Limit: 5 pro 10 min und IP (in-memory), Better Auth selbst 5/min für Sign-in/up.
- **SYSTEMADMIN** wird bei jedem Request aus `SYSTEMADMIN_EMAILS` abgeleitet (`lib/session.ts`, `effectiveRole`); DB-Wert `SYSTEMADMIN` wird ignoriert. Weil es keinen E-Mail-Versand gibt, ließe sich die Admin-Adresse sonst vorab registrieren → **Setup-Code** (ENV `SYSTEMADMIN_SETUP_CODE`, Default `AUTH_SECRET`) ist für diese Adressen Pflicht.
- **Regeln** (`lib/permissions.ts`, getestet in `lib/permissions.test.ts` + `tests/admin.db.test.ts`): niemand vergibt SYSTEMADMIN; ADMIN ändert/sperrt/löscht SYSTEMADMIN nie; ADMIN vergibt/ändert nur Rollen unterhalb von ADMIN; Rechte der Rolle SYSTEMADMIN sind unveränderlich; `permissions.edit`/`roles.assign` der Rolle ADMIN ändert nur SYSTEMADMIN (Aussperr-Schutz). Verstoß → `ForbiddenError` (HTTP 403-Semantik).
- **Service-Schicht** `lib/services/*`: jede Schreiboperation prüft Recht + Regel und schreibt `AuditLog`. UI-Actions (`app/admin/actions.ts`) sind dünn.
- **Verifizierung** (`lib/services/verification.ts`): Einladung (Token 24 Byte base64url, nur SHA-256 gespeichert, 7 Tage, atomar einmalig), Umbenennungs-Code `ALLY-XXXX` (Prüfung nach jedem Import im Worker/Skript), manuelle Freigabe (`members.approve`). Alle verlangen, dass der Spieler **in der eigenen Allianz-Gruppe** ist.
- **Tests:** `npm run ci` (Unit + DB-Integration); E2E: `npm run e2e` (baut, startet Server auf :3100, DB `ally_e2e`, Chromium aus `PLAYWRIGHT_BROWSERS_PATH`).
- Offen: Ursprung der Inaktiven-Suche aus „Meine Dörfer“ (M5) und „letzten Ursprung merken“; Discord-OAuth (später); Rate-Limit auf Message-Post (M4).

## UI (nach `docs/ui/screenflow.html`)
- Route-Gruppen: `app/(app)` = Sidebar-Shell (verlangt Login, Navigation nach Rechten), `app/(auth)` = zentrierte Karte (Login, Register, Invite, Claim, Forgot). Bausteine (`.card`, `.btn`, `.field`, `.pill`, `.tabs`, …) und Tokens stehen in `app/globals.css` 1:1 aus dem Screenflow; Schriften: Systemstack (Arial / Georgia für das Logo / Courier für Zahlen), keine externen Fonts (DSGVO).
- Admin: eine Seite `/admin?tab=…` (`members | rights | channels | alliances | users | audit`), sichtbare Tabs nach Recht. Server-Actions in `app/(app)/admin/actions.ts`; Zeilenaufbau des Mitglieder-Tabs in `lib/admin-members.ts` (getestet).
- Inaktive: Ursprung `?origin=village:<id>` oder `(x|y)`; zuletzt gewählter Ursprung in `User.lastOrigin`. „Eigene Dörfer“ = Dörfer der Spieler mit verifiziertem `PlayerLink`.
- E2E-Selektoren nutzen Labels/Rollen (`npm run e2e`).

## M4 — Chat
- **Zugriff** (`lib/chat/access.ts`, rein): ALLY → `chat.read` + `minReadRole`; TASKFORCE → Mitgliedschaft (ADMIN/SYSTEMADMIN sehen alle). Schreiben zusätzlich `chat.write` (+ `minWriteRole`). Unbekannte Mindestrolle = ADMIN (fail closed). Archivierte Kanäle sind unsichtbar. Dieselbe Prüfung gilt für Seiten, API, Socket-Join und Anhangs-Auslieferung.
- **Services** `lib/services/chat.ts` (Nachrichten, Kanäle, Tags, Task-Forces), HTTP-Schicht `app/api/chat/*` + `app/api/attachments/[id]` (Fehler → 403/4xx über `lib/http.ts`). UI: `components/chat/*`, Seiten `app/(app)/chat/*`.
- **Markdown** (`lib/chat/markdown.ts`): Body bleibt Quelltext; Rendern erzeugt React-Knoten (`components/Md.tsx`), nie HTML. Nur http(s)-Links, `rel=noopener noreferrer nofollow ugc`. Koordinaten `(x|y)` (−200…200) → `/inactive?origin=…`.
- **Realtime:** `server.ts` (Socket.IO, Session-Cookie im Handshake, Join prüft Recht frisch aus der DB); Services veröffentlichen über `lib/realtime.ts` (`globalThis.__io`, weil Next-Bundle und tsx-Prozess dieselbe Instanz teilen müssen). Räume `channel:<id>`; der Client tritt allen lesbaren Kanälen bei (für Live-Zähler).
- **Suche:** GIN-Ausdrucksindex `to_tsvector('german', body)` (Migration `m4_chat_search`); Abfragen müssen denselben Ausdruck verwenden. Bewusst keine generierte Spalte (Prisma-Drift).
- **Anhänge:** `lib/chat/attachments.ts` (file-type-Sniffing, sharp, pdftoppm → Docker-Image installiert `poppler-utils`), `lib/storage.ts` (`StorageAdapter`, lokal unter `STORAGE_DIR`), Limits per ENV. Originalbilder werden ohne Metadaten neu kodiert; Thumbnail/Web als WebP. Auslieferung: `Content-Type` aus dem gespeicherten Typ, `nosniff`, `CSP: default-src 'none'; sandbox`, Text immer als Download. Orphans: Cron `40 * * * *` im Worker.
- **Rate-Limits:** Nachrichten 30/min, Uploads 20/min je Nutzer (`lib/chat/limits.ts`, in-memory).
- E2E laufen sequenziell (`01-invite` legt boss/member an, `02-chat` nutzt sie).

## M5 / Phase 2 (Gerüst)
- **Eigene Dörfer** (`lib/services/villages.ts`): Dörfer der Spieler mit verifiziertem `PlayerLink`; jede Dorf-Route/-API prüft `getOwnVillage` (fremd → 404/403).
- **Erinnerungen** (`lib/reminders.ts`): pur, läuft auch auf Leerdaten; Schwelle aus Setting `staleDays` (Default 2). „Nie aktualisiert“ zählt als veraltet.
- **KI-Schnittstellen** (`lib/ai/`): `AiClient` (classify/extract/advise), `StubAiClient`, `ScreenshotPipeline` (klassifizieren → extrahieren → gegen Spieldaten validieren → `VillageState`; niedrige Konfidenz → `needs_review`) mit Stub. `setAiClient()` tauscht die Implementierung. Cache-Idee für Empfehlungen: Hash aus Instruktionen + VillageState-Zeitstempeln.
- **Screenshot-Upload** (`/api/screenshots`): ein Weg für alle Arten, Gerät wird erkannt (keine Auswahl); gleiche Bildprüfung wie im Chat (`processUpload`), Ablage über `StorageAdapter` unter `shots/<user>/…`.
- **Spieldaten:** Schema ist versioniert (`GameDataVersion`); Import erst nach Freigabe. **Schritt 1 (Analyse der Knowledge Base) konnte nicht laufen:** `knowledgebase.legends.travian.com` und `support.travian.com` sind aus der Sandbox nicht erreichbar (CONNECT 403). Bitte Netzfreigabe oder einen Export der Seiten/Netzwerkaufrufe (HAR) liefern, dann folgt der Bericht zu Format, Abdeckung und Aktualität.
