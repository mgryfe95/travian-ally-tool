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
- **Regeln** (`lib/permissions.ts`, getestet in `lib/permissions.test.ts` + `tests/admin.db.test.ts`): es gibt nur GUEST < MEMBER < MODERATOR < ADMIN; ADMIN hat implizit alle Rechte (keine Admin-Spalte in der Matrix) und darf jede Rolle vergeben/ändern; Nicht-Admins nur Rollen unterhalb ihres Rangs; Konten aus `SYSTEMADMIN_EMAILS` (Notzugang) sind immer ADMIN und nicht sperr-/löschbar/umstufbar; niemand sperrt/löscht sich selbst. Verstoß → `ForbiddenError` (HTTP 403-Semantik).
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
- **Zugriff** (`lib/chat/access.ts`, rein): ALLY → `chat.read` + `minReadRole`; TASKFORCE → Mitgliedschaft (ADMIN sieht alle). Schreiben zusätzlich `chat.write` (+ `minWriteRole`). Unbekannte Mindestrolle = ADMIN (fail closed). Archivierte Kanäle sind unsichtbar. Dieselbe Prüfung gilt für Seiten, API, Socket-Join und Anhangs-Auslieferung.
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

## Screenshot-Erkennung (Phase 2)
- `lib/ai/reading.ts`: einheitliches Lesungsformat (`kind`, `rows` mit `cells`/`texts`, `totals`, `fields`, `buildings`, `topBar`) + JSON-Schema für Structured Outputs; `lib/ai/prompt.ts`: Abbildung je Art; `lib/ai/claude.ts`: SDK-Aufruf (Few-Shot-Beispiele mit Prompt-Caching, `refusal`/`max_tokens` → Fehler).
- `lib/ai/validate.ts`: `assess()` = Konfidenz. Harte Prüfung ×0,45, weiche ×0,9, Unsicherheitsmeldungen ×0,93, Konsens (`agreementOf`, Felder/Gebäude als Multimenge), Deckel durch `selfRating`. Summenzeilen sind das stärkste Signal; Lagerbestände mit 1 % Toleranz.
- `lib/ai/pipeline.ts` (`VisionPipeline.process/confirm`), `lib/ai/apply.ts` (Lesung → `VillageState`, nur Dörfer des Kontos; Zuordnung per Koordinaten oder Dorfname). `VILLAGE_TROOPS_PRESENT` und `BATTLE_REPORT` werden gelesen und gespeichert, aber noch nicht in den Dorfzustand übernommen.
- Lernmodus: `VisionExample` (Bild + Gold-Lesung, je Art max. 30), `VisionAlias` (Emojis/Kürzel → Bedeutung, `scripts/vision-alias.ts`). ENV: `VISION_PASSES`, `VISION_AUTO_ACCEPT`, `VISION_LEARNING_MIN`, `ANTHROPIC_MODEL`.
- Muster: `tests/fixtures/screenshots/*.png` + `.gold.json`; `npx tsx scripts/eval-vision.ts` misst die Trefferquote (API-Key nötig). Neue Art/Layout: Muster + Gold ablegen, Prompt-Abschnitt und ggf. Prüfung ergänzen.
- Beobachtungen: Desktop-Produktionstabelle zeigt Getreide brutto, Seitenleiste/Mobil netto; Schmiede „-“ = nicht verfügbar (null), in Truppen-/Hospitaltabellen = 0; Koordinaten teils mit Unicode-Minus.

## Tag-Typen
`TagType` (multi, required, forTaskforces, sortOrder) ↔ `ChannelTagType` (n:m zu Allianz-Kanälen); `Tag.tagTypeId` (Name nur je Typ eindeutig, Löschen des Typs mit Tags per `Restrict` gesperrt). `postMessage` validiert über `validateTags`: Tag bekannt, Typ im Kanal angeboten (`offeredTagTypes`; Task-Force-Kanäle zusätzlich alle Typen mit `forTaskforces`), Einzelauswahl max. ein Tag, Pflicht-Typen belegt. Migration `tag_types` überführt bestehende Tags in den Typ „Kategorie“ und weist ihn allen Allianz-Kanälen zu. Recht: `tags.manage`.

## Allianz-Schedule
`CallTemplate` (Art, Text, Standardkanal) und `AllianceCall` (Ziel aus `Village`/`Player` per Koordinate, `template` als Snapshot, Status draft|scheduled|sending|sent|cancelled). `lib/services/schedule.ts`: `createCall`, `sendCall`, `dispatchDueCalls` (von `server.ts` alle 30 s; Claim per `updateMany status→sending` verhindert Doppelversand), `renderCall` (Platzhalter, Link = `APP_URL/players/<id>`), `berlinToDate` (Eingabe Europe/Berlin → UTC). Posten geschieht im Server-Prozess, damit Socket.IO live zustellt. Rechte `schedule.view` (Member+), `schedule.manage` (Admin), Migration `schedule`. Der Autor der Kanalnachricht ist der Ersteller des Calls.

## Task-Force-Rollen und Einladungen
`TaskforceMember.role` = founder | lead | member | reader (Migration setzt den Ersteller auf founder); `TaskforceInvite` (pending|accepted|declined|revoked) – `createTaskforce(memberIds)` erzeugt Einladungen statt Mitgliedschaften. `ChatCtx.taskforceRoles` steuert `canWriteChannel` (Leser schreiben nicht; Admins immer). Services: `inviteToTaskforce`, `respondTaskforceInvite`, `revokeTaskforceInvite`, `setTaskforceRole` (nur Gründer/Admin), `removeTaskforceMember` (Lead entfernt keine Leads, Gründer nie, Selbst-Verlassen erlaubt), `archiveTaskforce` (nur Gründer/Admin). `addTaskforceMember` bleibt als Direktzuweisung für Verwalter/Tests.

## Messenger
Tabellen `DmThread` (ein Thread je Paar via `pairKey`), `DmMessage`, `DmRead`, `Broadcast`, `BroadcastRecipient`; Service `lib/services/messenger.ts` (`getOrCreateThread`, `sendDm`, `listThreads`, `readThread`, `sendBroadcast`, `listInbox`, `listSent`, `unreadCounts`). Erreichbar = aktives Konto, kein Gast. Rechte `messenger.use` (Member+), `messenger.broadcast` (Moderator+). Live über persönlichen Socket-Raum `user:<id>` (`publishUser("messenger:new")`, Beitritt beim Verbinden in `server.ts`); der Client (`MessengerLive`) lädt die Seite neu. DMs sind Klartext (kein Markdown, keine Anhänge) und liegen unverschlüsselt in der DB – Admins mit DB-Zugriff können sie technisch lesen (im Onboarding erwähnen). Migration `messenger`.

## Dateiablage
`StorageAdapter` (`lib/storage.ts`): lokal unter `STORAGE_DIR` (Docker-Volume `/app/storage`, im Backup enthalten), austauschbar gegen S3/MinIO. Screenshots: nur WebP (q88, max. 2600 px, ohne Metadaten) + 400-px-Vorschau, das Original wird nicht gespeichert (`lib/screenshots.ts`); Auslieferung über `/api/screenshots/<id>/file` nur an Uploader/Admin. Aufbewahrung: Worker-Cron 03:20 `purgeOldScreenshots` (`SCREENSHOT_RETENTION_DAYS`, Lern-Beispiele bleiben). Seite `/files` = „Meine Bilder & Dateien“ (löschen inkl. Beispiele). Vision-API: Structured-Output-Schema ohne Union-Typen (Limit 16) – Wire-Format `apiSchema`/`readingJsonSchema`, Umwandlung `apiToReading`/`readingToApi` in `lib/ai/reading.ts`.

## Spieldaten aus der Legends-Wissensdatenbank
Die Seite `knowledgebase.legends.travian.com` ist eine React-SPA; ihre Daten stecken als Literale in `main.js` (Routen: nur `buildings`, `buildings/:gid`, `items` – **keine Truppen**). `lib/gamedata/kb.ts` liest sie mit einem eigenen strikten Literal-Parser (nichts wird ausgeführt) und wandelt: 49 Gebäude (gid), Stufen (Kosten r1–r4, Bauzeit, Kulturpunkte, Einwohner/Versorgung, Effekte), Voraussetzungen (inkl. `Tribe`-Beschränkung), Namen (DE/EN) und Völker-IDs (1 Römer, 2 Germanen, 3 Gallier, 4 Natur, 5 Natars, 6 Ägypter, 7 Hunnen, 8 Spartaner, 9 Wikinger – wie in map.sql). Bauzeiten sind in der Quelle Basiswerte (Hauptgebäude Stufe 1, Speed 1); die Umrechnung auf die Welt-Geschwindigkeit nutzt die Formel der Quelle `10·round(t/speed/10)`, der Hauptgebäude-Faktor (0,964^(Stufe−1)) kommt bei der Anzeige je Dorf. Import: `npx tsx scripts/import-kb.ts <main.js> [--dry-run]` mit Welt-Prüfung (`lib/world-profile.ts`). Ändert sich die Seitenstruktur, bricht der Parser mit klarer Meldung ab.

## Einheitennamen (Support-Artikel)
Quelle: Help Center „Infantry and Cavalry Units comparison table“ (`support.travian.com/en/articles/187-…`, serverseitig gerendert, 7 Tabellen = Völker in map.sql-ID-Reihenfolge-unabhängig über die Überschrift erkannt). `lib/gamedata/units.ts` liest **nur die Namen** (Spaltenköpfe = Einheitenplatz 1…6 in Spielreihenfolge; Spalten mit Klammerzusatz wie „Legionnaire (Northern Legends)“ sind Varianten ohne Platz). Seit 2026-10-19 werden auch die **Werte** gelesen (`parseUnitStats`): Der Artikel nennt sie für Schmiede/Kaserne/Stall Stufe 20; Grundwerte werden zurückgerechnet (Schmiede `v(l)=b+(b+300u/7)(1.007^l−1)`, Ausbildung `t(l)=t1·0.9^(l−1)`, Zeiten auf 10 s gerundet). Achtung: Zeile „Crop upkeep“ = Geschwindigkeit, „Capacity“ = Getreideverbrauch (im Artikel vertauscht beschriftet). Verifiziert am Legionär (40/35/50, 1600 s). Plätze 7–10 (Belagerung, Häuptling, Siedler) stehen nicht im Artikel → bleiben „Einheit N“. Tabelle `UnitName(tribeVid, slot, nameEn, nameDe)`; `nameUnits()` in `lib/ai/apply.ts` setzt Namen über das Volk des Dorfbesitzers (`Player.tribe` = Volk-ID, Annahme: gleiche IDs wie in der Wissensdatenbank – beim ersten Import prüfen). Import: `npx tsx scripts/import-unit-names.ts <en.html> [de.html] [--dry-run]`.
Deutsche Namen und Plätze 7–10 pflegt man händisch: `--template namen.json` erzeugt eine Vorlage (Vorlage mit den bekannten Namen: `docs/unit-names.template.json`; verifiziert aus eigenen Spiel-Screenshots: Römer 1/2, Gallier 1/3/5), ausgefüllt wieder einlesen mit `--overrides namen.json`. Englische Namen dürfen der Quelle nicht widersprechen; neue Plätze brauchen `en`.

## i18n
- Quelle: `lib/i18n/en/<ns>.ts`; `lib/i18n/de/<ns>.ts` ist mit `Record<keyof typeof en, string>` typgleich. Neuer Text = Schlüssel `<ns>.<bereich>.<name>` in beiden Dateien. Platzhalter `{name}`; Plural über getrennte Schlüssel.
- Server: `const {{ t, locale }} = await getT()`; Client: `useT()`/`useLocale()` (Provider im Root-Layout). Fehler: `throw new XError("err.…", params)`, Anzeige `localizeError(e, locale)`.
- Neue Sprache: Ordner `lib/i18n/<code>/` kopieren, in `LOCALES`/`INTL_TAG`/`LOCALE_NAMES` (lib/i18n/index.ts) eintragen.

## Vorteile je Stufe und Speicher
- `BuildingLevel.effects` (JSON) enthält die Quell-Schlüssel (z. B. `production1`, `productionBoost1`, `storageWarehouse`, `trainingTimeStable`, `traps`). `lib/gamedata/effects.ts` ordnet jedem Schlüssel Art (rate/capacity/count/seconds/bonus/timeFactor), Gruppe und Richtung zu; Anzeige und KI-Kontext nutzen dieselben Formatierer. Neuer Schlüssel in der Quelle: dort eintragen + `overview.fx.<id>` in en/de (unbekannte Schlüssel erscheinen sonst als Zahl).
- Speicher: `storage()` (lokal) für Chat-Dateien, `screenshotStorage()` für Screenshots (S3 + lokaler Fallback beim Lesen/Löschen). Kontingent in `lib/quota.ts` (zählt `sizeBytes` ohne Thumbnails von Chat-Dateien).

## Screenshot-Dateien: Lebenszyklus
Upload (WebP, S3 Pflicht in Produktion) → Auslese → bei Auto-Übernahme sofort löschen; bei manueller Bestätigung bleibt das Bild als `VisionExample` (max. 30 je Art, `KEEP_EXAMPLES_PER_KIND`) und wird freigegeben, sobald es herausfällt. `removedAt` markiert gelöschte Dateien; die 30-Tage-Aufbewahrung (`purgeOldScreenshots`) löscht weiterhin alles Übrige.

## Erwähnungen & Antworten
`lib/chat/mentions.ts` (Regex/Handle) wird von Markdown (Hervorhebung), Client (Autovervollständigung) und Server (`syncMentions`) genutzt. Handle = Name klein, Leerzeichen → `_`. `Mention` ist pro Nachricht eindeutig je Nutzer. Antworten: `Message.replyToId`, Flattening auf die Hauptnachricht in `postMessage`.


## Navigation (Seitenleiste)
`app/(app)/layout.tsx` baut die Punkte serverseitig (`NavItem.children` = Untermenü, `group` = Zwischenüberschrift). `components/SideNav.tsx` (`NavList`, auch im Mobilmenü) klappt ein Untermenü auf, wenn der Punkt oder ein Kind aktiv ist (`activeChild`: Query-Kinder exakt, sonst erstes Kind als Standard). `useSearchParams` steht in einer eigenen Suspense-Grenze – ohne sie blieben Weiterleitungen von Server-Actions auf derselben Seite hängen. Kein `loading.tsx` unter `/villages/[id]` (gleicher Effekt + 404 käme als 200); Ladeanzeige über `useLinkStatus`. Admin-Reiter zentral in `lib/adminTabs.ts`.

## E-Mail-Bestätigung
Better Auth `emailVerification` (sendOnSignUp, 24 h, Auto-Login nach Bestätigung). Der Versand und das Kriterium hängen an `mailEnabled()` (SMTP_HOST gesetzt): `actorRole(..., requireEmail)` liefert `UNVERIFIED` für unbestätigte Konten (Notzugang ausgenommen) → Layout leitet auf `/claim` (Karte „E-Mail-Adresse bestätigen“ + erneut senden, 3×/15 min). Migration `email_verified_existing` markiert Bestandskonten als bestätigt.

## Image-Größe und Geheimnisse
`.dockerignore` schließt `backups/`, `storage/`, `.env*` (außer `.env.example`), Logs und Testberichte aus – vorher landeten DB-Dumps und `.env`-Kopien im Image. Nach `next build` wird `.next/cache` entfernt. `deploy.sh` führt vor dem Build `docker builder prune -af` und `docker image prune -f` aus (nächster Build lädt npm-Pakete neu, dafür kein Platzproblem) und nach erfolgreichem Start `docker image prune -af` – betrifft alle ungenutzten Images des Servers, laufende Container nie.
