# Changelog (Report-Fassung) — 2026-10-14

Ausführliche, append-only Fassung: `docs/CHANGELOG.md`. Dies ist die Zusammenfassung dieser Session.

- **M1** Gerüst: Next.js, Prisma, Worker, Docker Compose, Health, CI (`npm run ci`).
- **M2** map.sql-Import (Format an echter Datei verifiziert), Status/Deltas/Events, Kartenwrap-Distanz, Inaktiven-Suche, Spieler-/Allianzseiten, Ereignis-Feed.
- **Allianz-Gruppe** (dringende Ergänzung): Typen je Allianz, „Eigene Allianz“ + „Allianz“ = eine Gruppe; Mitgliederabgleich; mehrere IDs in `TRAVIAN_ALLIANCE_ID`.
- **M3** Accounts/Rollen/Rechte (SYSTEMADMIN-Schutz), Einladung, Dorfname-Code, manuelle Freigabe, Audit-Log, Admin-UI.
- **UI-Angleich** an `screenflow.html`; Systemschriften statt Google Fonts.
- **M4** Chat: Kanäle, Sammelraum, Tags, Task-Forces, Realtime, Suche, Anhänge mit Vorschau/Lightbox.
- **SMTP** Passwort-Reset.
- **M5 + Phase-2-Gerüst** Meine Dörfer, KI-Instruktionen, Erinnerungen, Screenshot-Upload (Stub), Spieldaten-Schema/-Seite/-Importformat.
- **Betrieb** Weltende-Erkennung + „Neue Welt“, Pruning der Dorf-Rohzeilen, Docker-Build-Fix (Platzhalter-Env beim Build), `scripts/backup.sh`, `scripts/deploy.sh`, `docs/DEPLOY.md`, Probe-Skript für die Wissensdatenbank.
- **Screenshot-Erkennung** (Claude Vision, 12 Arten, Konfidenz-Prüfungen, Lernmodus + Review-UI, Eval-Skript).

Commits: siehe `git log` auf Branch `claude/new-session-hlffy1` (PR #1).
