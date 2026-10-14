# CC-Auftrag — Travian Ally Tool · MVP (Schnell-Run)

> Projekt-Slug: `travian-ally-tool` · Notion-Root: `3f912988-7097-813a-be0b-e9ee8831f987`
> Stand: 14.10.2026 · Quelle: Chat https://claude.ai/chat/3f8396b4-1960-410b-9762-e96c8eb5b39c

## 0. Ziel
Ein Web-Tool zur Koordination einer Allianz in **Travian: Legends** (Server `https://ts12.x1.europe.travian.com`):
öffentliche Kartendaten (`/map.sql`) auswerten, Mitglieder verifiziert einbinden, Kommunikation über Chat-Kanäle
und Task-Forces, Rollen- und Rechteverwaltung. Spätere Phase: eigene Dörfer, Screenshot-Upload, KI-Bauberatung, Truppen-OCR.

**Regel:** Das Tool automatisiert **nichts** im Spiel und scrapt keine eingeloggten Seiten. Einzige externe Datenquelle ist `map.sql`, plus das, was Nutzer selbst hochladen.

## 1. Stack (fix)
- **Next.js 15** (App Router, TypeScript strict) + **Tailwind** + shadcn/ui
- **PostgreSQL 16** + **Prisma**
- **Better Auth**: E-Mail + Passwort (argon2) und DB-Sessions; Discord-OAuth später als Option vorsehen
- **Realtime:** Socket.IO in einem Custom Node Server (`server.ts`), der auch Next.js ausliefert
- **Worker:** eigener Container (`worker/`) mit node-cron für den map.sql-Import
- **KI:** Anthropic Claude API direkt (`@anthropic-ai/sdk`), Modell per ENV (Phase 2)
- **Deployment:** Docker Compose (`app`, `worker`, `db`) auf VPS; Monorepo mit einem Repo `travian-ally-tool`
- **Tests:** Vitest (Unit/Integration, Test-DB via Docker) + Playwright (E2E)

## 2. ENV (`.env.example` anlegen)
```
DATABASE_URL=postgresql://ally:ally@db:5432/ally
APP_URL=http://localhost:3000
AUTH_SECRET=change-me
SYSTEMADMIN_EMAILS=max@example.com        # kommagetrennt; diese Accounts sind immer SYSTEMADMIN
TRAVIAN_SERVER_URL=https://ts12.x1.europe.travian.com
TRAVIAN_ALLIANCE_ID=                      # optional; sonst im Admin-UI setzen
IMPORT_CRON=15 * * * *                    # stündlich prüfen, nur bei geändertem Hash importieren
INACTIVE_DAYS=3                           # Default, im Admin-UI überschreibbar
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

## 3. Phase 1 — MVP (jetzt bauen)

### M1 · Gerüst
- Monorepo-Struktur, Docker Compose, Prisma-Migrationen, Seed-Script, Health-Endpoint
- Lint, Typecheck und Tests laufen als CI-Script (`npm run ci`)

### M2 · map.sql-Import und Auswertung
- Der Worker lädt `${TRAVIAN_SERVER_URL}/map.sql` und bildet einen SHA-256-Hash. Ist der Hash unverändert, wird übersprungen.
- **Parser:** jede Zeile `INSERT INTO \`x_world\` VALUES (...);`. Bekannte Spalten in dieser Reihenfolge: `fieldId, x, y, tribe, villageId, villageName, playerId, playerName, allianceId, allianceName, population`. Neuere Server liefern weitere Spalten, z. B. `region, isCapital, isCity, hasHarbor, victoryPoints`.
  **Pflicht:** zuerst eine echte map.sql vom Server ziehen, die Spaltenzahl und -bedeutung verifizieren und als gekürzte Fixture in die Tests legen. Unbekannte Zusatzspalten tolerant behandeln, also speichern statt abzubrechen. Strings korrekt unescapen (Quotes, Unicode, Kommas in Namen).
- **Speicherung:**
  - `Snapshot(id, fetchedAt, hash, rowCount)`
  - `VillageSnapshot(snapshotId, villageId, fieldId, x, y, tribe, playerId, playerName, allianceId, allianceName, population, extra jsonb)`
  - aktuelle Sicht: `Player`, `Alliance`, `Village`
  - Tagesaggregat: `PlayerDailyStat(playerId, date, population, villageCount, allianceId)`
- **Abgeleitete Kennzahlen:**
  - Bevölkerungs-Delta 1/3/7 Tage
  - Status `active | stagnant | inactive | declining`: inactive, wenn die Bevölkerung seit ≥ `INACTIVE_DAYS` Snapshots nicht gestiegen ist; declining bei Rückgang
  - Events aus dem Diff zum Vortag: neues Dorf, Dorf verloren oder erobert (Besitzerwechsel), Allianzwechsel, Spieler verschwunden
- **UI:**
  - **Inaktiven-Suche mit Entfernungsmesser:** Der Ursprung wird per Dropdown aus den **eigenen Dörfern** des eingeloggten (verifizierten) Spielers gewählt. Alternativ lässt sich eine freie Koordinate eingeben.
    - Ergebnisliste sortierbar nach Entfernung (Felder, 1 Nachkommastelle; Travian-Kartenwrap beachten)
    - Filter: max. Entfernung, Bevölkerung, Tage inaktiv, Allianz, Volk
    - Der zuletzt gewählte Ursprung wird pro Nutzer gemerkt.
    - Die Distanzlogik liegt in einer eigenen, getesteten Funktion, damit sie später für Laufzeiten (Einheit, Turnierplatz) wiederverwendbar ist.
  - Spieler- und Allianz-Detailseite mit Verlaufsgrafik
  - Ereignis-Feed

### M3 · Accounts, Verifizierung, Rollen und Rechte
- **Rollen:** `SYSTEMADMIN > ADMIN > MODERATOR > MEMBER > GUEST`
  - SYSTEMADMIN wird **nur** aus `SYSTEMADMIN_EMAILS` abgeleitet, bei jedem Login und Request. Die Rolle ist nicht in der DB änderbar.
  - **Harte Regeln (serverseitig und per Test abgesichert):** Ein ADMIN kann einen SYSTEMADMIN nie ändern, degradieren, sperren oder löschen. Er kann niemanden zum SYSTEMADMIN machen und keine Rechte der Rolle SYSTEMADMIN ändern.
  - SYSTEMADMIN und ADMIN dürfen Rechte bearbeiten.
- **Rechte-Matrix:** `RolePermission(role, permission)`, editierbar im Admin-UI und mit sinnvollen Defaults geseedet. Beispiele für Permissions:
  - `chat.read`, `chat.write`, `chat.moderate`
  - `chat.upload`, `tags.manage`, `taskforce.create`, `taskforce.manage`
  - `members.invite`, `members.approve`, `roles.assign`, `permissions.edit`
  - `map.view`, `settings.edit`
- Zusätzlich je Kanal: `minReadRole` und `minWriteRole`.
- **Verifizierung Account ↔ Travian-Spieler** (`PlayerLink(userId, travianPlayerId, status pending|verified|rejected, method invite|village_rename|admin, verifiedBy, verifiedAt)`). Mehrere User pro Spieler sind erlaubt (Duals).
  1. **Einladungslink (Standard):** Im Admin-UI erscheint die Liste aller Spieler der eigenen Allianz aus dem letzten Snapshot. Pro Spieler wird ein Einmal-Link erzeugt: `Invite(tokenHash, travianPlayerId, createdBy, expiresAt (7 Tage), usedAt)`. Ein Button „IGM-Text kopieren“ liefert einen fertigen Nachrichtentext mit Link. Wird der Link eingelöst, folgt die Registrierung, der Link wird automatisch `verified` und der Nutzer bekommt die Rolle MEMBER.
  2. **Dorf-Umbenennungs-Beweis:** Wer sich ohne Einladung registriert, wird GUEST. Er beansprucht einen Spieler und erhält einen Code (`ALLY-XXXX`). Taucht der Code beim nächsten Import als Dorfname eines Dorfs dieses Spielers auf, wird der Link automatisch `verified` und die Rolle auf MEMBER gehoben. Gilt nur, wenn der Spieler in der eigenen Allianz ist.
  3. **Manuell:** MODERATOR oder höher mit `members.approve` bestätigt.
- Verlässt ein Spieler laut map.sql die Allianz, wird das im Admin-UI markiert. Es gibt keine automatische Sperre.
- Audit-Log `AuditLog(actorId, action, target, before, after, at)` für Rollen-, Rechte- und Verifizierungsänderungen.

### M4 · Chat
- `Channel(id, tree ALLY|TASKFORCE, name, slug, sortOrder, taskforceId?, minReadRole, minWriteRole, archivedAt)`
- **Seed für den Baum ALLY:** Deff-Call, Deff-Reports, Off-Call, Off-Reports, Ressources, Settlement, Sitter, Mixed topics. Kanäle sind im Admin-UI anleg-, umbenenn- und sortierbar.
- **Sammelraum „Alle“:** eine virtuelle Ansicht über alle ALLY-Kanäle, die der Nutzer lesen darf. Jede Nachricht zeigt ein Kanal-Badge. Schreiben im Sammelraum erfordert eine Kanalauswahl.
- `Message(id, channelId, authorId, body (Markdown, sanitized), createdAt, editedAt, deletedAt)`
  - Edit und Delete durch den Autor; Moderation mit `chat.moderate`
  - Koordinaten wie `(12|-34)` werden automatisch zu Links auf die Spielerkarte bzw. Dorfdetail im Tool
- **Tags:** `Tag(id, name, color, createdBy)`, verwaltet mit `tags.manage`. `MessageTag(messageId, tagId)` erlaubt 0..n, im UI standardmäßig 1. Filter nach Tag in jedem Kanal und im Sammelraum.
- **Task-Forces:**
  - `Taskforce(id, name, description, createdBy, archivedAt)` und `TaskforceMember(taskforceId, userId, role lead|member)`
  - Beim Anlegen entsteht automatisch ein Kanal im Baum TASKFORCE.
  - Lesbar nur für Mitglieder; ADMIN und SYSTEMADMIN sehen alle.
  - Eigene Sidebar-Sektion, getrennt vom Baum ALLY. Task-Force-Nachrichten erscheinen nicht im Sammelraum „Alle“.
- **Realtime:** Socket.IO-Room pro Kanal. Die Berechtigung wird beim Join serverseitig geprüft. Ungelesen-Zähler pro Kanal.
- Pagination per Cursor, Volltextsuche (Postgres `tsvector`).
- **Datei-Upload im Chat mit Vorschau:**
  - **Eingabe:** Button „Anhängen“, Drag & Drop in den Nachrichtenbereich und Einfügen aus der Zwischenablage (Strg+V, wichtig für Screenshots). Mehrere Dateien pro Nachricht, maximal 10. Vor dem Senden erscheint eine Vorschau mit Entfernen-Button. Optional lässt sich ein Text dazuschreiben.
  - **Erlaubte Typen** (Allowlist, geprüft per MIME-Sniffing, nicht per Dateiendung):
    - Bilder: PNG, JPG, WebP, GIF
    - PDF
    - Text, CSV, Log
  - **Limits:** Bild 10 MB, sonst 20 MB. Alle Limits per ENV konfigurierbar.
  - **Verarbeitung serverseitig** mit `sharp`:
    - EXIF- und Metadaten entfernen
    - Thumbnail (max. 480 px) und eine Web-Version (max. 1920 px) erzeugen
    - Breite und Höhe speichern, damit beim Laden nichts springt
    - PDF: Vorschau der ersten Seite als Bild
    - Text, CSV, Log: die ersten ca. 20 Zeilen als Snippet
  - **Darstellung in der Nachricht:**
    - Bilder als Thumbnail-Raster (1 Bild groß, ab 2 Bildern als Raster); Klick öffnet eine Lightbox mit Zoom, Blättern und Download
    - PDF als Karte mit Seitenvorschau, Dateiname, Größe und „Öffnen“
    - Text, CSV, Log als aufklappbares Snippet in Monospace
    - Andere Typen sind nicht erlaubt.
  - **Speicherung** über denselben `StorageAdapter` wie in Phase 2 (lokales Volume). Er wird deshalb schon in M4 gebaut, nicht erst in Phase 2. Modell: `Attachment(id, messageId?, uploaderId, kind image|pdf|text, mime, sizeBytes, width?, height?, storageKey, thumbKey?, previewKey?, createdAt)`.
  - **Ablauf:** Upload vor dem Senden, die Nachricht referenziert dann die Attachment-IDs. Verwaiste Uploads ohne Nachricht werden nach 24 h per Cron gelöscht.
  - **Zugriff:** Dateien werden nur über einen authentifizierten Endpoint ausgeliefert, der dieselbe Kanal-Leseberechtigung prüft wie die Nachricht. Es gibt keine öffentlichen URLs. Kurzlebige signierte Links sind für die Lightbox erlaubt.
  - **Recht:** neues Recht `chat.upload`, für Member aufwärts standardmäßig aktiv. Löschen einer Nachricht löscht auch ihre Anhänge, das gilt ebenso bei Moderation.
  - **Sicherheit:**
    - SVG und HTML sind nicht erlaubt.
    - Auslieferung mit `Content-Disposition` passend zum Typ und `X-Content-Type-Options: nosniff`
    - Rate-Limit auf Uploads
  - **Tests:**
    - Typ-Allowlist inklusive Datei mit falscher Endung
    - Größenlimit
    - Zugriff aus fremdem Kanal ergibt 403, ebenso für Task-Force-Nichtmitglieder
    - EXIF wird entfernt
    - Aufräumen verwaister Uploads
    - E2E: Screenshot einfügen → Vorschau → senden → Lightbox

### M5 · KI-Instruktionen und Dörfer (Vorbereitung Phase 2)
- **KI-Instruktionen auf zwei Ebenen**, beide gut sichtbar oben auf der jeweiligen Seite (siehe Mockup):
  - Account: `User.aiInstructions` (Text), editierbar auf der Übersicht
  - Dorf: `VillageProfile(villageId, userId, aiInstructions)`, editierbar im Dorf-Dashboard. Dort werden die Account-Instruktionen schreibgeschützt mit angezeigt.
- „Meine Dörfer“: Liste der Dörfer des verifizierten Spielers aus map.sql. Jedes Dorf hat ein eigenes Dashboard.

## 4. Phase 2 — Schema, Seiten-Gerüst und Schnittstellen jetzt anlegen, Logik später
**UI-Vorlage:** Mockup „Travian Ally Tool – Mockup“, Screens Übersicht, Dorf-Dashboard und Spieldaten.

### 4.1 Spieldaten-Referenz-DB (immer aktuelle Spielinfos)
- `Tribe(id, key, name, traits jsonb)`
- `Building(id, key, name, category, tribeRestriction?, maxLevel, prerequisites jsonb, description)`
- `BuildingLevel(buildingId, level, costWood, costClay, costIron, costCrop, upkeep, buildTimeSec, culturePoints, effects jsonb)`. In `effects` stehen die Vorteile je Stufe, zum Beispiel Produktion/h, Lagerkapazität, Versteckmenge, Fallen, Bauzeit- oder Ausbildungsbonus.
- `Unit(id, tribeId, key, name, attack, defInf, defCav, speed, carry, costWood, costClay, costIron, costCrop, upkeep, trainTimeSec, building, researchReq jsonb)`
- `GameDataVersion(id, source, importedAt, serverSpeed, notes)`. Jede Zeile verweist auf ihre Version, damit Patches nachvollziehbar bleiben.
- **Datenquelle:** Werte dürfen **nicht** geschätzt oder halluziniert werden.
  - **Referenz:** offizielle Travian Legends Knowledge Base (`https://knowledgebase.legends.travian.com/en-US/buildings`, verlinkt aus `https://support.travian.com/en/articles/33-buildings-and-resource-fields-statistics`). Sie enthält Kosten, Effekte und Voraussetzungen je Stufe, umrechenbar nach Speed.
  - **Schritt 1, nur Analyse, kein Import:** Prüfen, ob die Knowledge Base ihre Tabellen aus einem abrufbaren Datenendpunkt (JSON) lädt. Format, Abdeckung (alle Völker inkl. Ägypter, Hunnen, Spartaner; Gebäude; Truppen) und Aktualität dokumentieren. Ergebnis als kurzer Bericht **zur Freigabe vorlegen**.
  - **Schritt 2, erst nach Freigabe:** Importer bauen. Die Rohdaten werden versioniert abgelegt (`GameDataVersion.source` = URL + Abrufdatum). Kein fortlaufendes Scraping, nur ein manuell ausgelöster Import.
  - **Gegenprüfung:** `github.com/kirilloid/travian` (Community, ohne Lizenz; das README untersagt die Nutzung von Travian-Inhalten ohne Zustimmung). Die Quelle dient **nur** zum automatischen Abgleich in Tests bzw. Reports, **nicht** als Importquelle. Abweichungen werden gelistet.
  - **Rechtliches:** Die Erlaubnis von Travian Games zur Datennutzung holt Max ein. Bis dahin bleibt der Import intern und privat.
- Spielgeschwindigkeit: Bau- und Ausbildungszeiten werden aus dem Basiswert und der Server-Geschwindigkeit berechnet, nicht pro Speed gespeichert.
- Admin-Seite „Spieldaten“ mit drei Tabs: Gebäude (mit Stufentabelle), Truppen (mit Volksfilter) und Völker. Bearbeiten erfordert das Recht `gamedata.edit`.

### 4.2 Ist-Zustand je Dorf (gespeist aus Screenshots)
- `VillageState(villageId, capturedAt, source screenshotId)` mit:
  - `resources` (Bestand, Kapazität, Produktion/h)
  - `fields` (18 Ressourcenfelder mit Stufe)
  - `buildings` (Slot, Gebäude, Stufe)
  - `troops` (im Dorf, unterwegs, Unterstützung)
  - `queues` (Bau- und Ausbildungsschleifen)
- Pro Bereich wird der Zeitstempel separat geführt: `troopsAt`, `resourcesAt`, `buildingsAt`. Ein Screenshot aktualisiert nur die Bereiche, die er enthält.
- Die Dörferstatistik aktualisiert mehrere Dörfer in einem Upload.

### 4.3 Screenshot-Upload und Erkennung
- **Ein einziger Upload-Weg pro Zweck.** Es gibt **keine** Auswahl Desktop/Mobile: der Scanner klassifiziert Layout und Gerät automatisch.
- `Screenshot(id, userId, villageId?, detectedKind RALLY_POINT|VILLAGE_STATS|VILLAGE_VIEW|RESOURCE_VIEW|UNKNOWN, detectedDevice DESKTOP|MOBILE|UNKNOWN, confidence, storageKey, status uploaded|parsed|needs_review|failed, parsed jsonb, createdAt)`
- **Pipeline:**
  1. Claude Vision klassifiziert Art und Gerät.
  2. Danach folgt die Extraktion mit einem art-spezifischen, strikten JSON-Schema.
  3. Die Werte werden gegen die Spieldaten validiert, z. B. bekannte Einheiten- und Gebäudenamen sowie plausible Stufen.
  4. Das Ergebnis wird in `VillageState` geschrieben.
  - Bei niedriger Konfidenz gilt `needs_review`: der Nutzer bestätigt oder korrigiert die erkannten Werte.
- Das Dorf wird aus dem Screenshot erkannt (Name oder Koordinaten). Gibt es dabei Konflikte mit dem Dorf, in dem hochgeladen wurde, wird nachgefragt.
- Speicherung über einen `StorageAdapter`: lokales Volume jetzt, später S3 bzw. MinIO.

### 4.4 Erinnerungen und KI-Tipps
- **Veraltete Daten:** Ist ein Bereich älter als X Tage (konfigurierbar, Default 2 Tage), erscheint auf der Übersicht ein Hinweis, z. B. „Du hast die Truppen von Dorf X vor 3 Tagen aktualisiert“. Der Hinweis enthält einen Direktlink zum passenden Upload.
- **KI-Tipps** auf der Übersicht (accountweit) und auf jedem Dorf-Dashboard (dorfbezogen): `POST /api/advisor/account` und `POST /api/advisor/village/:id`.
  - Input: Account- und Dorf-Instruktionen, `VillageState`, Spieldaten-DB (Kosten und Nutzen der nächsten Stufen) sowie map.sql-Umfeld
  - Output: strukturiertes JSON mit Rang, Maßnahme, Begründung, Kosten und Nutzen
  - Ergebnisse werden gecacht und erst bei neuem Ist-Zustand neu berechnet.
- Im Dorf-Dashboard zeigt die Gebäudetabelle die aktuelle Stufe, den Nutzen jetzt, die Kosten der nächsten Stufe und den Nutzen danach (alles aus 4.1).

### 4.5 Umfang in diesem Auftrag
- **Bauen:** Prisma-Schema für 4.1–4.4, Seiten-Gerüste nach dem Mockup mit Leerzuständen, Interfaces `AiClient` und `ScreenshotPipeline` mit Stub, Erinnerungslogik (läuft schon auf Leerdaten).
- **Noch nicht bauen:** echte Claude-API-Calls und den Spieldaten-Import. Beides kommt nach Freigabe der Datenquelle und der Prompts.

## 5. Nicht im Scope
Spielautomatisierung · Scraping eingeloggter Seiten · Mehrere Server oder Allianzen (Server-URL und Allianz-ID sind aber konfigurierbar, nicht hartkodiert) · Mobile App (responsive Web reicht).

## 6. Qualität und Abnahme
- Test-First. Alle Tests **2× in Folge grün**, bevor ein Meilenstein als fertig gilt.
- **Pflicht-Tests:**
  - map.sql-Parser mit echter Fixture, inklusive Sonderzeichen in Namen
  - Inaktivitäts- und Event-Berechnung über 4 synthetische Snapshots
  - Distanz mit Kartenwrap
  - Alle SYSTEMADMIN-Schutzregeln (Admin versucht Änderungen → 403)
  - Rechteprüfung beim Kanal-Join und beim Schreiben
  - Task-Force-Kanal ist für Nicht-Mitglieder unsichtbar
  - E2E: Einladung erzeugen → einlösen → verifiziert → Nachricht mit Tag in Deff-Call → erscheint im Sammelraum
- Sicherheit:
  - Alle Rechte serverseitig prüfen
  - Rate-Limit auf Auth und Message-Post
  - Markdown sanitizen
  - Invite-Tokens nur gehasht speichern
- `docs/USER.md` als Kurz-Anleitung für Admins: Einladung, Rechte, Kanäle, Tags.
- Am Ende eine Session-Report-Datei nach ProjectOS-Konvention (siehe CLAUDE.md im Klon).

## 7. Reihenfolge
M1 → M2 → M3 → M4 → M5 → Phase-2-Gerüst (4.5). Nach jedem Meilenstein kurz berichten: Stand, Abweichungen, offene Fragen.
**Bei Unklarheiten nachfragen statt raten**, insbesondere zum tatsächlichen Spaltenformat der map.sql.


---
## Nachtrag 14.10.2026 — Allianz-Gruppe (dringend)
Mehrere Allianzen, die zusammengehören, gelten intern als **eine** Allianz.
- Jede Allianz kann von ADMIN/SYSTEMADMIN (Recht `alliances.classify`) einen Typ bekommen: **Eigene Allianz** (OWN), **Allianz** (ALLIED), NAP, Neutral, Feind.
- **Eigene Gruppe = OWN ∪ ALLIED.** Überall, wo „eigene Allianz“ steht (Einladungsliste, Dorf-Umbenennungs-Beweis „nur wenn in eigener Allianz“, Austrittsmarkierung, Filter), gilt die ganze Gruppe.
- **Abgleich:** „Mitglieder in unserem System“ (verifizierte Accounts) vs. „Mitglieder unserer Allianz-Gruppe“ (map.sql): wer hat ein Konto, wer nicht, welche Konten gehören zu Spielern außerhalb der Gruppe.
