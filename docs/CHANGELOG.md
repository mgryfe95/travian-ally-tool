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
