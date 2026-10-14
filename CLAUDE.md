# CLAUDE.md — Direktive Claude Code

## Projekt-Anker
`travian-ally-tool` · Notion-Root-ID: `3f912988-7097-813a-be0b-e9ee8831f987`
In jedem Changelog-Eintrag mitführen.

## Geltungsbereich
Ein Monorepo `travian-ally-tool` (Abweichung vom 5-Repo-Template, bewusst). Quelle der Wahrheit: Notion (lesend). Geschrieben wird nur Code + `docs/`; Ausnahme: Session-Report nach `projectos-reporter`. **Niemals nach Notion schreiben.**

## Nicht lesen
`[USER]`-Seiten / Anwender-Dokumentation, `_meta/INIT`, Poster, Onboarding-Material.

## Gate (hart)
Slug + Root-ID gesetzt, Root-ID ≠ Template-Root `38b12988-7097-81ba-b045-dbd07e115c11`. Sonst Stopp und Mensch fragen. Bei Unklarheiten nachfragen statt raten (insb. map.sql-Spaltenformat).

## Stack (projektspezifisch, ersetzt FastAPI-Zeile des Templates)
Next.js 15 · TypeScript strict · Tailwind · PostgreSQL 16 + Prisma · Better Auth · Socket.IO (`server.ts`) · Worker (`worker/`, node-cron) · Docker Compose. Spec: `docs/projectos/CC_AUFTRAG_MVP.md`.

## Dokumentation (Pflicht, im selben Commit wie der Code)
- `docs/CHANGELOG.md` — ein Eintrag je Session (ISO-Datum · Feature-ID · Was & Warum · Commits)
- `docs/DEVELOPER.md` — Architektur und technische Entscheidungen
- `docs/USER.md` — Admin-Kurzanleitung
- `docs/projectos/entscheidungen.xlsx` — Liste wichtiger Entscheidungen (mit Datum + Chat-Link)
- `docs/projectos/nebenthemen.md` — Punkte, die Projekt/Aufbau betreffen, aber nicht zur aktuellen Aufgabe passen

## Qualität
Test-First. `npm run ci` (lint, typecheck, test) muss 2× in Folge grün sein, bevor ein Meilenstein gilt.

## Session-Report (Pflicht)
Am Ende eine Datei nach `projectos-reporter` (`main`, append-only, vorher `git pull --rebase`):
`travian-ally-tool/<YYYY-MM-DD>T<HHMM>-travian-ally-tool.md` mit Frontmatter `type`, `projekt-slug`, `notion-root`, `repo`, `commits`.
