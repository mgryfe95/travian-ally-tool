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
