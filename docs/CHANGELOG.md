# Changelog (append-only)

## 2026-10-14 · travian-ally-tool/core/m1-geruest
Was & Warum: M1 Gerüst — Next.js 15 (App Router, strict), Tailwind, Prisma + erste Migration/Seed, Custom Server mit Socket.IO, Worker-Stub (node-cron), Health-Endpoint, Docker Compose (app/worker/db), `npm run ci`, Vitest. Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-14 · travian-ally-tool/core/m2-mapsql
Was & Warum: M2 map.sql-Import und Auswertung. Parser (verifiziert an echter map.sql von ts12.x1.europe: 23 611 Zeilen, 16 Spalten, Zusatzspalten 11–15 = region, isCapital, isCity, hasHarbor, victoryPoints), Importer mit SHA-256-Skip, Snapshot/VillageSnapshot/Player/Alliance/Village/PlayerDailyStat/Event, Status- und Delta-Berechnung, Event-Diff, Distanz mit Kartenwrap (401er Torus), Seiten Inaktive/Spieler/Allianz/Ereignisse. Worker importiert beim Start und per Cron.

## 2026-10-14 · travian-ally-tool/core/alliance-group
Was & Warum: Dringende Ergänzung — mehrere Allianzen gelten intern als eine. Allianzen bekommen einen Typ (`AllianceClassification`: OWN „Eigene Allianz“, ALLIED „Allianz“, NAP, NEUTRAL, ENEMY). OWN + ALLIED bilden die „eigene Gruppe“. Abgleich „Mitglieder im System“ vs. „Mitglieder der Gruppe“ in `compareMembers`; Inaktiven-Suche blendet die Gruppe standardmäßig aus. Admin-UI zum Setzen folgt mit M3 (Recht `alliances.classify`).

## 2026-10-14 · travian-ally-tool/core/m3-accounts
Was & Warum: M3 Accounts, Rollen, Verifizierung. Better Auth (E-Mail + Passwort mit argon2id, DB-Sessions, Rate-Limit), Rollen SYSTEMADMIN (nur ENV) > ADMIN > MODERATOR > MEMBER > GUEST, editierbare Rechte-Matrix mit geseedeten Defaults, harte SYSTEMADMIN-Schutzregeln (serverseitig, getestet → 403), PlayerLink/Invite (nur Hash gespeichert)/Dorf-Umbenennungs-Code/manuelle Freigabe, Audit-Log, Admin-UI (Allianzen/Allianz-Gruppe, Mitglieder & Abgleich, Nutzer, Rechte, Audit), `/login`, `/register`, `/invite/[token]`, `/account`. Seiten der Karte verlangen `map.view`. Playwright-E2E für Einladung → Einlösen → verifiziert.

## 2026-10-14 · travian-ally-tool/ui/screenflow-alignment
Was & Warum: `screenflow.html` (UI-Vorlage, verbindlich) lag erst nach M3 vor. UI angeglichen: Design-Tokens/Komponenten in `globals.css`, Sidebar-Shell mit Server-/Allianz-Kopf, Auth-Screens (Login, Einladung mit Passwort-Wiederholung, Gast-Verifizierung `/claim`), Inaktive nach Vorlage (Ursprung = eigene Dörfer des verifizierten Spielers oder freie Koordinate, zuletzt gewählter Ursprung pro Nutzer gespeichert, Filter, Δ 7 Tage, Status), Admin als Tabs (Mitglieder & Einladungen inkl. Rolle je Konto und „Alle Uneingeladenen: Links erzeugen“, Rechte-Matrix mit Checkboxen, Kanäle & Tags als Platzhalter für M4). Zusätzliche Tabs Allianzen (Allianz-Gruppe), Konten, Audit-Log. Platzhalter-Seiten Meine Dörfer, Chat, Spieldaten. Planungsdokumente (Auftrag v2, Entscheidungen v2, Screenflow) ins Repo übernommen (`docs/ui/`, `docs/projectos/`).

## 2026-10-14 · travian-ally-tool/chat/m4-chat
Was & Warum: M4 Chat. Kanäle (Baum ALLY mit 8 Standardkanälen, Baum TASKFORCE), Sammelraum „Alle“, Nachrichten (Markdown-Teilmenge ohne HTML-Ausgabe, Koordinaten → Links), Tags 0..n, Task-Forces mit Mitgliedern/Leads, Realtime per Socket.IO (Rechteprüfung beim Join), Ungelesen-Zähler, Cursor-Pagination, Volltextsuche (Postgres `tsvector`-Index), Anhänge (Upload vor dem Senden, MIME-Sniffing, sharp: EXIF-Strip, Thumbnail 480 px/Web 1920 px, PDF-Seitenvorschau via pdftoppm, Text-Snippet; `StorageAdapter`; authentifizierte Auslieferung mit Kanal-Leserecht, nosniff/CSP), Rate-Limits, Aufräum-Cron für verwaiste Uploads, Admin-Tab „Kanäle & Tags“, Chat-UI nach Screenflow (Desktop + Mobile-Select/Tab-Bar, Lightbox). GUEST bekommt `chat.read` (Kanäle steuern per minReadRole). Tests: Unit (Zugriff, Markdown, Anhänge), DB-Integration (17), E2E (Tag/Sammelraum/Paste/Lightbox, Task-Force-Sichtbarkeit, Realtime, Anhangs-Zugriff).

## 2026-10-14 · travian-ally-tool/auth/smtp-reset
Was & Warum: SMTP (nodemailer, ENV `SMTP_*`) für Passwort-Reset über Better Auth (`/forgot`, `/reset-password`): Link 1 h gültig, einmalig, beendet Sitzungen; unbekannte Adressen ohne Mail und ohne Fehler. Ohne `SMTP_HOST` bleibt nur der Hinweis. E-Mail-Verifizierung bei Registrierung ist nicht aktiviert (weiterhin Setup-Code für Systemadmin-Adressen).

## 2026-10-14 · travian-ally-tool/villages/m5-phase2-geruest
Was & Warum: M5 + Phase-2-Gerüst nach Screenflow. **M5:** `User.aiInstructions`, `VillageProfile`, Übersicht (`/`: Account-KI-Instruktionen prominent, „Aktualisierungen fällig“, Empfehlungen-Leerzustand, Dörferstatistik-Upload, Dörfertabelle mit Alter je Bereich), Dorf-Dashboard (`/villages/[id]`: Uploads je Zweck, Dorf-Instruktionen mit read-only Account-Text, Leerzustände für Rohstoffe/Truppen/Gebäude), „Meine Dörfer“ = Dörfer der verifizierten Spieler (fremde Dörfer → 404). **Phase 2 (nur Schema/Gerüst):** `VillageState` (Zeitstempel je Bereich), `Screenshot`, Spieldaten-Schema (`GameDataVersion`, `Tribe`, `Building`, `BuildingLevel`, `Unit`), Seite Spieldaten mit 3 Tabs + Leerzustand (Zeiten würden aus Basiswert × Server-Speed berechnet), Interfaces `AiClient`/`ScreenshotPipeline` mit Stubs, Advisor-Endpunkte `POST /api/advisor/account|village/:id` (leere Liste), Screenshot-Upload `POST /api/screenshots` (speichert, Pipeline-Stub), Erinnerungslogik `lib/reminders.ts` (Schwelle Default 2 Tage, Setting `staleDays`). Keine echten Claude-Calls, kein Spieldaten-Import.

## 2026-10-14 · travian-ally-tool/ops/deploy-world-gamedata
Was & Warum: Betrieb und Datenpflege. Mehrere Allianz-IDs (`TRAVIAN_ALLIANCE_ID=36,7`, `lib/ids.ts`); Weltende-Erkennung (36 fehlgeschlagene stündliche Importe in Folge → „beendet“, Hinweis im UI, Auto-Reset bei Erfolg) und `scripts/new-world.ts` (Weltdaten leeren, Konten/Chat behalten, Member → Gast); Pruning der Dorf-Rohzeilen (nur die letzten 3 Snapshots); Spieldaten-Importformat + validierter Importer (`scripts/import-gamedata.ts`, `docs/gamedata-format.md`) und Probe-Skript für die Wissensdatenbank (`scripts/probe-knowledgebase.ts`, läuft auf dem Server); Docker: Build mit Platzhalter-Env (ohne sie schlug `next build` fehl), Healthchecks, `restart`, Port nur lokal, Worker-Volume; `scripts/backup.sh`, `scripts/deploy.sh`, `docs/DEPLOY.md`; `docs/reports/`.

## 2026-10-14 · travian-ally-tool/villages/troops-overview
Was & Warum: Neue Anforderung — Admins und Moderatoren sehen die Truppen der Mitglieder (Planung/Koordination). Neues Recht `troops.view` (Moderator, Admin; Migration `troops_permission`), Seite `/troops` (Summen je Einheit, je Mitglied und Dorf, Alter der Stände markiert, Filter), Einsicht wird im Audit-Log vermerkt. Datenquelle: manuelle Eingabe im Dorf-Dashboard (`lib/troops.ts`, Format `Name; im Dorf; unterwegs; Unterstützung`), später Screenshot-Pipeline. Transparenz: Hinweis für Mitglieder auf Einladungsseite und im Dorf-Dashboard.

## 2026-10-14 · travian-ally-tool/phase2/vision
Was & Warum: Screenshot-Erkennung für 1.0 (Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`). Claude Vision mit Structured Outputs liest 12 Screenshot-Arten (Mobil + Desktop, DE/EN) aus 14 Mustern in ein einheitliches Format; Konfidenz aus deterministischen Prüfungen + Konsens mehrerer Durchläufe; Lernmodus (Review-Seite `/screenshots`, Bestätigungen werden Beispiele, Auto-Übernahme erst nach `VISION_LEARNING_MIN`); Übernahme in `VillageState` (Truppen, Rohstoffe, Felder, Gebäude, Queues); `scripts/eval-vision.ts` und `scripts/vision-alias.ts`. Echte Genauigkeit lässt sich nur mit API-Key messen (Eval-Skript). Migration `vision_learning`.

## 2026-10-15 · travian-ally-tool/m3/assign-player
Was & Warum: Admin → Konten: Moderator/Admin kann ein Konto direkt einem Spieler der eigenen Gruppe zuordnen (`assignPlayer`, Audit `link.assign`, Gast → Mitglied), ohne dass das Konto vorher einen Claim startet. Anlass: erster Systemadmin hatte keinen Weg zur Verknüpfung. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/m4/tag-types
Was & Warum: Tag-Typen (Achsen) an Kanäle gebunden — je Typ Einzel-/Mehrfachauswahl, Pflicht, Task-Force-Geltung, Kanalzuweisung; Admin-UI „Tag-Typen & Tags“, Chat-Composer zeigt nur Typen des Zielkanals, Validierung serverseitig; Migration `tag_types`. Zusätzlich Layout-Fix Admin → Kanäle & Tags. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/m6/schedule
Was & Warum: Allianz-Schedule — Admins legen Calls (Angriff, Deff, Angriffstag) mit Koordinaten an; Text aus Vorlage mit Platzhaltern, Spieler/Dorf/Link automatisch aus map.sql; geplant (automatisch zur Zeit) oder auf Abruf; Seite `/schedule`, Rechte `schedule.view/manage`, Migration `schedule`. Folgt: Task-Force-Einladungen/Rollen, Messenger. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/m4/taskforce-roles
Was & Warum: Task-Forces verwaltbar — Einladung mit Annahme, vier Rollen (Gründer/Lead/Mitglied/Leser), Rollenvergabe und Archivieren nur durch den Gründer, Selbst-Verlassen; Einladungsbanner im Chat, Verwaltungsseite erweitert; Migration `taskforce_invites`. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/m7/messenger
Was & Warum: Messenger getrennt von den Kanälen — 1:1-Direktnachrichten (alle Mitglieder), Rundnachrichten (Moderator+; Zielgruppen alle/Rolle/Task-Force/Auswahl, Antwort per DM, Lesestatus für den Absender), Ungelesen-Zähler in der Navigation, Live-Zustellung über persönliche Socket-Räume; Rechte `messenger.use/broadcast`, Migration `messenger`. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/phase2/files
Was & Warum: (1) Fix Screenshot-Erkennung: API-Schema hatte 19 Union-Parameter (Limit 16) → Wire-Format ohne Unions (Strings/Sentinels). (2) Screenshots werden beim Upload zu WebP komprimiert (Original wird nicht gespeichert) mit Vorschau; Aufbewahrungsfrist per Worker; Seite „Meine Bilder & Dateien“ (`/files`) zum Verwalten/Löschen; Migration `screenshot_files`. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/phase2/village-view
Was & Warum: Dorfseite zeigt jetzt die erkannten Werte (Rohstoffe inkl. Produktion/brutto/Händler, Rohstofffeld-Stufen, Gebäude mit Stufen, Bauschleife) – zuvor wurden freigegebene Gebäude gespeichert, aber nicht angezeigt. Bestätigen meldet einen Fehler, wenn die Lesung keinem eigenen Dorf zugeordnet werden kann; in der Prüfansicht lässt sich das Dorf ausdrücklich wählen; Upload zeigt „Zur Prüfung“. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/gamedata/world-binding
Was & Warum: Vertrags-Invariante für Spieldaten — Import nur für die eigene Welt: Host, Spielversion (`GAME_VERSION`, Standard legends) und Server-Geschwindigkeit (aus Host `xN` oder `GAME_SPEED`) müssen zur Datei passen, sonst Ablehnung der gesamten Datei; keine Umrechnung. Format: `world` + `serverSpeed` Pflicht; `GameDataVersion` speichert Welt/Version; Migration `gamedata_world`. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/gamedata/kb-buildings
Was & Warum: Spieldaten-Import aus der Legends-Wissensdatenbank (Gebäude: 49, 995 Stufen, 9 Völker) mit eigenem sicheren Literal-Parser, Welt-/Speed-Bindung und Trockenlauf; `Building.gid`; Migration `building_gid`. Befund: die Wissensdatenbank enthält keine Truppen → Einheitennamen brauchen eine andere Quelle. Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · travian-ally-tool/gamedata/unit-names
Was & Warum: Einheitennamen je Volk (Plätze 1–6 für alle 7 Völker) aus dem offiziellen Legends-Support-Artikel, nur Namen; Truppen aus Screenshots erhalten dadurch echte Namen (Volk aus map.sql); Probe-Skript für Support-Artikel; Migration `unit_names`. Offen: Plätze 7–10, deutsche Namen (Probe der DE-Fassung). Anker `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`.

## 2026-10-15 · UI-Datenschutz (E-Mail/Admin-Rolle) · Notion-Root 3f912988-7097-813a-be0b-e9ee8831f987
- Keine fremden E-Mail-Adressen mehr im Frontend (auch nicht für Admins): Spalte aus Admin→Konten entfernt, Admin→Mitglieder zeigt den Namen; `email` verlässt `loadMemberRows`/`MemberRow` nicht mehr, `maskEmail` entfernt.
- Rolle „Systemadmin“ ist im UI nicht mehr sichtbar (Anzeige „Admin“, 🔒 nicht änderbar); Rechte-Matrix ohne Systemadmin-Spalte. Backend-Logik und `SYSTEMADMIN_EMAILS` unverändert.
- Entscheidung: Englisch ist Pflicht für die Beta und wird Basissprache (i18n-Dateien, Nutzersprache am Konto) – nächster Schritt.

## 2026-10-15 · i18n (EN Basis, DE Übersetzung) · Notion-Root 3f912988-7097-813a-be0b-e9ee8831f987
- UI komplett zweisprachig: Wörterbücher `lib/i18n/{en,de}/<namespace>.ts` (ca. 1000 Schlüssel, Typ erzwingt Parität; Test `lib/i18n/i18n.test.ts`). Englisch ist Quelle/Fallback.
- Sprache pro Konto (`User.locale`, Migration `user_locale`), Reihenfolge Konto > Cookie `lang` > Browser > Englisch. Umschalter in Sidebar und auf Login-/Registrierungsseiten.
- Fehler: alle Fehlerklassen erben von `AppError(key, params)`; `message` ist Englisch, Anzeige per `localizeError`. Mails, Einladungstext, Call-Texte nutzen die Sprache des Empfängers/Auslösers.
- `fmt/delta` brauchen jetzt die Locale; `fmtDate` (Europe/Berlin). E2E laufen mit `de-DE`.
- Noch nicht übersetzt: KI-Prompts, Seed-Vorlagen/-Kanäle, Audit-Rohwerte, gelöschter Nutzer in Listen (immer „deleted“), Better-Auth-Eigentexte.

## 2026-10-16 · Spieldaten-Vorteile, S3, Kontingent · Notion-Root 3f912988-7097-813a-be0b-e9ee8831f987
- Spieldaten: Gebäude-Tabelle zeigt je Stufe die Vorteile (Produktion, Boni, Lager/Versteck, Zeitfaktoren, Fallen …) mit einheitlicher Darstellung und Δ zur Vorstufe; neuer Tab „Vorteile“ vergleicht einen Vorteil über alle Gebäude. Zentrale Beschreibung in `lib/gamedata/effects.ts` (Art/Einheit/Richtung je Vorteil), dieselben Funktionen liefern der KI normalisierte Werte (`levelBenefits`, `benefitsMarkdown`).
- Truppen-Tab zeigt die importierten Einheitennamen (Plätze 1–10, DE/EN); Völker-Tab ohne Roh-JSON; Quelle im Kopf nur als Host.
- Screenshots in eigenem S3-kompatiblen Bucket (`S3_BUCKET_SCREENSHOTS`, …; alte lokale Dateien bleiben lesbar); Chat-Dateien bleiben lokal.
- Speicherplatz 10 MB je Nutzer (`USER_QUOTA_MB`) für Screenshots + Chat-Dateien; Upload über Limit → 413; Anzeige auf „Meine Bilder & Dateien“.
- Gelöschte Chat-Dateien hinterlassen einen Platzhalter („Datei vom Uploader entfernt“), zählen nicht mehr zum Kontingent (Migration `attachment_removed`).

## 2026-10-16 · Registrierung nur für berechtigte Allianzen, Verifizierungssperre · Notion-Root 3f912988-7097-813a-be0b-e9ee8831f987
- Neuer Allianz-Typ „Enge Bündnispartner“ (`CLOSE_ALLY`, Migration `close_ally`): nicht Teil der eigenen Gruppe, aber verifizierbar.
- Registrierung ohne Einladung nur mit Ingame-Spielernamen, dessen Allianz eigene Gruppe oder enger Bündnispartner ist; der Code zum Dorf-Umbenennen wird sofort erzeugt.
- Unverifizierte Konten (Rolle GUEST) sind komplett gesperrt: alle App-Seiten leiten auf `/claim`; GUEST-Rechte entfernt (Migration löscht sie). „Als Gast weiter“ entfällt.
- Knopf „Verlinkung nachweisen“ (`proveLink`): prüft sofort gegen den letzten Import, lädt sonst map.sql neu (global höchstens alle 5 Minuten) und verifiziert bei Treffer. Travian veröffentlicht map.sql nur etwa einmal täglich – ist die Datei unverändert, meldet die Seite das.

## 2026-10-16 · map.sql-Abruf nach der täglichen Veröffentlichung · Notion-Root 3f912988-7097-813a-be0b-e9ee8831f987
- Worker holt map.sql zusätzlich gezielt um `MAP_RELEASE_TIME` (00:05) +0/+5/+15 Min. in `GAME_TIMEZONE`; Verifizierung per Dorfname greift so direkt nach der Veröffentlichung (23:55–0:05).
- Verifizierungsseite: „Benenne bis 23:55 (Serverzeit) ein Dorf in CODE um“, nächste Veröffentlichung und Zeit der Prüfung werden angezeigt; Zurückbenennen ab 0:05 möglich (`lib/map-release.ts`).

## 2026-10-16 · Vorteile↔Gebäude verknüpft, Registrierungs-Dropdown, Einladung per IGM-Tab · Notion-Root 3f912988-7097-813a-be0b-e9ee8831f987
- Vorteile relational: Tabelle `BuildingLevelEffect` (FK auf `BuildingLevel`, Migration füllt Bestand aus dem JSON); Gebäude-Tabelle und Vorteile-Vergleich lesen dieselben Zeilen und verlinken sich gegenseitig (Spaltenkopf ↗ → Vergleich, Gebäudename ↗ → Gebäude; ausgewählte Spalte/Gebäude hervorgehoben).
- Registrierung/Verifizierung: Dropdown (alphabetisch) mit Spielern der eigenen Gruppe und enger Bündnispartner ohne verifiziertes Konto; bereits verknüpfte Spieler werden auch serverseitig abgelehnt.
- „Einladung erzeugen“ öffnet den Tab mit dem Ingame-Nachrichtenfenster des Spielers (`IGM_WRITE_URL`, Standard `{server}/messages/write?to={id}` (Spieler-ID aus map.sql)) und kopiert den Einladungstext automatisch in die Zwischenablage (Betreff/Text lassen sich nicht per URL vorbelegen); bei Sammelerzeugung je Spieler ein „Ingame-Nachricht öffnen“-Link.
- Mobile Kontoleiste (Sprache, Dateien, Abmelden), da die Sidebar dort ausgeblendet ist.

- Kulturpunkte je Gebäudestufe erscheinen jetzt als Vorteil in der Gebäude-Tabelle und im Vorteile-Vergleich (Migration `culture_points_effect` übernimmt den Bestand).

- Koordinaten `(x|y)` sind überall Direktlinks auf die Travian-Karte (`/karte.php?zoom=1&x=…&y=…`, neuer Tab): in Chat/Calls/Messenger (inkl. Unicode-Minus) sowie in Dorf-, Spieler-, Inaktiven-, Ereignis-, Schedule-, Truppen- und Übersichtsseiten. Angezeigt werden weiter nur die Koordinaten (`lib/coords.ts`, `components/CoordLink.tsx`).

- Vorteile-Tabelle: Änderung je Stufe als „Δ +20 %“ (absolute Differenz) statt „pp“; die KI-Ausgabe nennt weiter explizit „pp“. Koordinaten-Links: E2E angepasst.

## 2026-10-16 · Redesign „Humans“ · Notion-Root 3f912988-7097-813a-be0b-e9ee8831f987
- Komplettes visuelles Redesign nach dem Klick-Mockup (Redesign-Canvas): Pergament-Fläche, Marine-Seitenleiste, Gold-Aktionen, Serifen-Überschriften, Gold-Banner bei Anmeldung/Registrierung, zweigeteilte Auth-Seiten mit Wappen. Alle Farben als Tokens in `app/globals.css`; Klassennamen unverändert, keine Funktionsänderung.
- Wappen als Platzhalter-SVG (`components/Logo.tsx`), bis die echte Logo-Datei vorliegt. Schriften: System-/Georgia-Stack (keine externen Fonts, DSGVO).
- Chat-Persistenz als E2E ergänzt (Nachricht bleibt nach Neuladen).

- Mobil: Burger-Menü (standardmäßig zu) mit der Hauptnavigation, Profilbild-Menü rechts oben (Konto, Dateien, Sprache, Abmelden); untere Tab-Leiste entfällt. Großes Wappen oben links in der Seitenleiste.

- Fix: Konto mit verifiziertem Link, aber Rolle Gast (z. B. von einem Moderator zurückgestuft) landete in einer Weiterleitungsschleife `/` ↔ `/claim` (Login „lädt ewig“). `/claim` leitet nur noch Nicht-Gäste nach `/` weiter und zeigt für verknüpfte, gesperrte Konten einen Hinweis; E2E `04-guest-lock`.

- `scripts/deploy.sh` neu: Backup → Code → Build → Start → 14 Prüfungen mit Haken, am Ende „Deployment erfolgreich/fehlgeschlagen“ inkl. Gründen; läuft im Hintergrund (`--status` zeigt das Ergebnis). Anmelde-Endpunkt-Prüfung fängt hängende Logins ab.

- Koordinaten-Selektor (`components/CoordInput.tsx`): X/Y mit −/+ und ±, Einfügen von „(12|-34)“ (auch Unicode-Minus) füllt beide Felder; in Schedule und Inaktiven-Suche. Hinweis in Admin → Allianzen: enge Bündnispartner registrieren sich wie Mitglieder als Gast und müssen sich verifizieren. Schedule-Seite lokal geprüft: geplante Calls erscheinen unter „Anstehend“.

- Spieldaten/Truppen zweisprachig: Gebäude haben `nameEn` (Migration `building_name_en` füllt den Bestand aus „EN: …“; Import schreibt es künftig direkt), Gebäude-, Völker- und Einheitenlisten folgen der UI-Sprache, ebenso Truppennamen in Dorf- und Truppenansicht (`lib/unit-labels.ts`, Übersetzung über die Einheitennamen-Tabelle). Neu importieren ist nicht nötig.

- Seitenleiste immer über die volle Höhe (sticky, 100vh), auch bei kurzen Seiten.

- Echtes Humans-Logo (aus dem Gemini-Entwurf freigestellt): `public/logo.png` (Anmeldeseiten), `public/logo-small.png` (Seitenleiste, Handy-Kopfzeile), `app/icon.png` (Browser-Tab). Platzhalter-SVG entfällt.

- **Keine Systemadmin-Rolle mehr**: Rollen sind GUEST < MEMBER < MODERATOR < ADMIN. Admins sind gleichberechtigt (immer alle Rechte, ändern jede Rolle und die Rechte-Matrix für Moderator/Mitglied/Gast), kein Schloss im UI. `SYSTEMADMIN_EMAILS` bleibt als Notzugang: diese Konten sind immer Admin und nicht sperr-/löschbar; das eigene Konto kann niemand sperren/löschen.

## 2026-10-16 · travian-ally-tool/schedule/termin-vs-senden
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: Calls trennen jetzt klar **Termin** (`eventAt`, Angriff/Ereignis, steht als `{zeit}` im Text) und **Sendezeit** (`at`, wann die Nachricht gepostet wird; leer = auf Abruf). Fehler, wenn Sendezeit nach dem Termin liegt. Migration `call_event_at` (Backfill eventAt = at). Standardvorlage „Sonstiges“ plus Fallback auf Standardvorlagen (vorher Fehler „Keine Vorlage“ bei Art Sonstiges, der kaum sichtbar war). Fehler und Erfolg auf der Seite deutlich sichtbar. „Anstehend“ zeigt auch bereits gesendete Calls mit künftigem Termin. Calls bearbeitbar (Ziel, Termin, Sendezeit, Titel, Notiz); Änderung/Absage eines gesendeten Calls meldet sich automatisch im Kanal, optional zusätzlich als Rundmail (nur mit SMTP). Inaktive-Filter: auch „ab 1/2 Tagen“ (Testzwecke, berücksichtigt dann auch noch nicht als inaktiv eingestufte Spieler).

## 2026-10-16 · travian-ally-tool/chat/tags-gruppiert
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: Tags im Chat werden nach Tag-Typ gruppiert angezeigt (Filterleiste und an der Nachricht, je „Typ: Tag Tag“). `MessageView.tags` enthält dafür `typeId`/`typeName` und ist nach Typ-Reihenfolge sortiert.

## 2026-10-16 · travian-ally-tool/storage/s3-pflicht-quota50
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: (1) Kontingent je Nutzer 10 → 50 MB (`USER_QUOTA_MB`). (2) **S3 ist im Produktivbetrieb Pflicht**: `parseEnv` bricht bei `NODE_ENV=production` ohne `S3_BUCKET_SCREENSHOTS`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` ab (Ausnahme nur Entwicklung/E2E: `ALLOW_LOCAL_SCREENSHOTS=true`); `scripts/deploy.sh` prüft das vor dem Bauen und danach per HeadBucket, ob der Bucket erreichbar ist. (3) **Bilddatei nach Auswertung nicht mehr nötig**: Das Bild dient nur der Auslese (OCR) und als Lern-Beispiel (max. 30 je Art). Automatisch übernommene Screenshots werden sofort gelöscht, bestätigte nur, sobald sie aus der Beispielauswahl fallen (`releaseScreenshotFiles`, Spalte `Screenshot.removedAt`, Migration `screenshot_removed_at`); Auswertung und Zeile bleiben, Kontingent wird frei.

## 2026-10-16 · travian-ally-tool/chat/erwaehnungen-antworten
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: @-Erwähnungen (`@Name`, Leerzeichen → `_`, Autovervollständigung im Eingabefeld, Hervorhebung im Text; nur aktive Nicht-Gäste mit Leserecht im Kanal, Neuberechnung beim Bearbeiten) und Antworten eine Ebene tief (Antwort auf Antwort hängt an der Hauptnachricht; Zitatzeile springt zum Original). Neue Seite **Meine Erwähnungen** (`/mentions`, im Profilmenü): Kanal, Zeit, Autor, Text; Klick öffnet `/chat?c=<Kanal>&m=<Nachricht>` und scrollt zur (Unter-)Nachricht (`listMessagesAround`). Migration `replies_mentions` (`Message.replyToId`, Tabelle `Mention`).

## 2026-10-16 · travian-ally-tool/schedule/call-typen-vorlagen
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: Eigene **Call-Typen** (z. B. „Ressourcen“; Tabelle `CallKindDef`, Schlüssel `custom:<id>`, optional „Koordinaten nötig“, Löschen nur ohne zugehörige Calls). Beim Anlegen einer **Vorlage** ist jetzt der Ziel-Kanal wählbar. Je Vorlage optional **Direktnachricht** beim Senden (`sendDm`): an die verifizierten Nutzer des Zielspielers, sonst an alle aktiven Nicht-Gäste mit Leserecht im Kanal; Absender = Ersteller. Migration `call_kinds_dm`.

## 2026-10-16 · travian-ally-tool/chat/mention-auswahl
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: Auswahl beim Tippen von `@` als Liste über dem Eingabefeld (alle Namen, Pfeiltasten/Enter/Tab/Esc, Klick). Selbst-Erwähnungen sind erlaubt und erscheinen unter „Meine Erwähnungen“ (vorher wurde der Autor ausgeschlossen, daher fehlte die Test-Erwähnung und der eigene Name in der Auswahl).

## 2026-10-16 · travian-ally-tool/import/taeglich-0-10
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: map.sql wird nur noch **einmal täglich um 0:10** (`MAP_RELEASE_TIME`, Zeitzone `GAME_TIMEZONE`, Nachversuche +5/+15 Min.) geholt; der stündliche Takt ist aus (`IMPORT_CRON` leer, optional). **Fehler behoben:** Tagesstände wurden unter dem UTC-Tag gespeichert, ein Import nach Mitternacht Serverzeit landete beim Vortag (zwei Importe → ein Tagesstand, daher keine Inaktiven). Jetzt zählt der Tag der Spielserver-Uhr; Migration `fix_daily_stat_date` korrigiert den bestehenden einzelnen Tag einmalig.

Nachtrag: Serverzeit ist fest UTC+1 ohne Sommerzeit, deshalb Standard `GAME_TIMEZONE=Etc/GMT-1` (statt Europe/Berlin). 0:10 Serverzeit = 01:10 Berliner Sommerzeit, im Winter 00:10.

## 2026-10-16 · travian-ally-tool/vision/tabellen-pruefung-gebaeude
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: (1) **Prüfung als Tabelle statt JSON:** Gebäude (Platz, Name aus den Spieldaten oder frei, Stufe), Rohstofffelder und Zeilen-Tabellen sind direkt editierbar, die Art des Screenshots ist wählbar; JSON nur noch im Expertenmodus. (2) **Gebäude im Dorf von Hand korrigieren** (`saveBuildings`, Dorfseite „Gebäude bearbeiten“). (3) **Namen je Platz bleiben erhalten:** Das Dorfzentrum-Bild liefert kaum Namen; fehlende Namen kommen vom bisherigen Stand (gleicher Platz, sonst gleiche Reihenfolge bei gleicher Anzahl, `inheritNames`). (4) **Bestätigung zurücknehmen** (`VisionPipeline.retract`, Knopf am Screenshot): entfernt das Lern-Beispiel, stellt den Screenshot zur erneuten Prüfung. (5) Dorfseite zeigt Nutzen aktuell, Kosten der nächsten Stufe und Nutzen danach aus den Spieldaten (Zuordnung über den Gebäudenamen, de/en).

## 2026-10-16 · travian-ally-tool/vision/kern-beispiele
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: (1) **Kern-Beispiel je Prüfung** (Haken, Standard an): Nur Kern-Beispiele bleiben samt Bild als Lernvorlage; ohne Haken wird die Auswertung übernommen und das Bild sofort gelöscht. (2) **Lern-Beispiele verwalten** (Screenshots-Seite): eigene (Admins alle) korrigieren (Tabellen-Editor) oder entfernen; `PATCH/DELETE /api/vision/examples/[id]`. Gelöschte Screenshots zählen nicht mehr als Beispiel (`deleteScreenshotFiles` entfernt auch das Beispiel). (3) **Gebäude-Auswahl nach Volk:** Dropdown mit den Gebäuden des Volkes des Dorfbesitzers (Gebäude ohne Volkbeschränkung + volkseigene), in der Prüfung nach gewähltem Dorf, im Dorf nach Besitzer. (4) **„Fehlende Plätze ergänzen“** für Gebäude (19–40) und Rohstofffelder (1–18).

## 2026-10-18 · travian-ally-tool/vision/marken-auf-bild
Anker: `travian-ally-tool` · `3f912988-7097-813a-be0b-e9ee8831f987`
Was & Warum: Gleiche Stufen sind in der Tabelle nicht unterscheidbar. Deshalb liefert die Erkennung jetzt je Gebäude/Feld die **Position der Marke im Bild** (x/y relativ 0–1; Schema, Prompt, Lern-Beispiele). Die Prüfung zeigt den Screenshot mit nummerierten Marken (`ShotMarkers`): Hover öffnet direkt einen Editor (Platz, Gebäude, Stufe), Klick hält ihn fest; Zeile ↔ Marke werden gegenseitig hervorgehoben. Fehlt eine Position (ältere Lesungen), setzt „⌖“ + Klick aufs Bild sie von Hand, „Position ändern“ verschiebt sie. „Neu auslesen“ liest einen offenen Screenshot erneut aus (z. B. um Positionen nachzuholen). Positionen in Kern-Beispielen trainieren die Erkennung mit.

