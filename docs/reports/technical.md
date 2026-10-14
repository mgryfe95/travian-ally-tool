# Technischer Report — travian-ally-tool (MVP + Phase-2-Gerüst)

Stand 2026-10-14 · Projekt-Slug `travian-ally-tool` · Notion-Root `3f912988-7097-813a-be0b-e9ee8831f987` · Repo `mgryfe95/travian-ally-tool` (Monorepo)

## Architektur
- **App:** Next.js 15 (App Router, TS strict) mit Custom Server `server.ts` (Next + Socket.IO), Tailwind + eigene Bausteine aus `docs/ui/screenflow.html`.
- **Worker:** eigener Container (gleiches Image), node-cron: stündlicher `map.sql`-Check (`IMPORT_CRON`), Umbenennungs-Code-Prüfung, Pruning der Dorf-Rohzeilen, Aufräumen verwaister Uploads (`40 * * * *`), Weltende-Erkennung.
- **Daten:** PostgreSQL 16 + Prisma 6 (Migrationen unter `prisma/migrations`). Volltextsuche über GIN-Ausdrucksindex (`m4_chat_search`).
- **Auth:** Better Auth 1.7, E-Mail + Passwort (argon2id), DB-Sessions; Registrierung nur über `/api/register`.
- **Deployment:** `docker-compose.yml` (db, app, worker), Reverse Proxy Nginx/Apache (`docs/DEPLOY.md`), `scripts/backup.sh`, `scripts/deploy.sh`.

## Module
| Bereich | Wichtigste Dateien |
| --- | --- |
| map.sql | `lib/mapsql/parser.ts`, `lib/import/importer.ts`, `lib/analytics.ts`, `lib/geo.ts`, `lib/inactive.ts` |
| Rollen/Rechte | `lib/permissions.ts`, `lib/services/admin.ts`, `lib/session.ts` |
| Allianz-Gruppe | `lib/alliance-group.ts` (OWN ∪ ALLIED = „eigene Gruppe“), `lib/ids.ts` (mehrere `TRAVIAN_ALLIANCE_ID`) |
| Verifizierung | `lib/services/verification.ts`, `lib/services/register.ts` |
| Chat | `lib/chat/*`, `lib/services/chat.ts`, `app/api/chat/*`, `app/api/attachments/[id]`, `components/chat/*`, `server.ts` |
| Dörfer/Phase 2 | `lib/services/villages.ts`, `lib/reminders.ts`, `lib/ai/*` (Stubs), `app/api/screenshots`, `app/api/advisor/*` |
| Spieldaten | `lib/gamedata/*`, `scripts/import-gamedata.ts`, `scripts/probe-knowledgebase.ts`, `docs/gamedata-format.md` |
| Betrieb | `lib/services/world.ts` (Weltende, neue Welt), `lib/mail.ts` (SMTP), `scripts/*.sh` |

## Sicherheitsmerkmale
- Alle Rechte serverseitig; SYSTEMADMIN nur aus `SYSTEMADMIN_EMAILS` (Setup-Code für die Registrierung dieser Adressen); ADMIN kann SYSTEMADMIN nie ändern (403, getestet).
- Invite-Tokens nur als SHA-256 gespeichert, einmalig, 7 Tage; Dorfname-Code `ALLY-XXXX`.
- Chat-Text wird nie als HTML ausgegeben (React-Knoten, nur http(s)-Links); Anhänge per MIME-Sniffing geprüft, EXIF entfernt, Auslieferung nur mit Kanal-Leserecht, `nosniff` + CSP-Sandbox.
- Rate-Limits: Auth (Better Auth, `AUTH_RATE_LIMIT_PER_MIN`), Registrierung, Nachrichten, Uploads.

## Tests (Stand)
- `npm run ci`: Lint + Typecheck + Vitest (Unit + DB-Integration gegen Postgres, ~160 Tests), 2× grün.
- `npm run e2e`: Playwright, 7 Szenarien (Einladung → verifiziert, Chat/Tag/Sammelraum/Paste/Lightbox, Task-Force-Sichtbarkeit, Realtime, Anhangs-Zugriff, Meine Dörfer, Spieldaten-Leerzustand).

## Bekannte Grenzen / offen
- Spieldaten-Import: Format und Validierung stehen, **Quelle noch nicht angebunden** (Wissensdatenbank aus der Entwicklungsumgebung nicht erreichbar → `scripts/probe-knowledgebase.ts` auf dem Server).
- KI-Anbindung (`AiClient`, `ScreenshotPipeline`, Advisor) nur als Stubs; keine Claude-Calls.
- Ein Welt-/Server-Kontext pro Installation (Neue Welt per `scripts/new-world.ts`).
- Rate-Limits und Socket-Räume sind in-memory (eine App-Instanz).
- Offene Entscheidungen/Nebenthemen: `docs/projectos/nebenthemen.md`.
