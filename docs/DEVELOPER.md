# Entwickler-Doku

- `app/` Next.js App Router · `server.ts` Custom Node Server (Next + Socket.IO) · `worker/` Cron-Worker (eigener Container, gleiches Image)
- `lib/env.ts` validiert ENV (zod); `SYSTEMADMIN_EMAILS` wird zu Liste normalisiert.
- `prisma/` Schema, Migrationen, Seed (idempotent). `Setting` hält Admin-UI-Overrides der ENV-Defaults.
- Lokal: Postgres 16 starten, `.env` aus `.env.example` (IMPORT_CRON in Anführungszeichen, wenn per Shell gesourct), `npx prisma migrate dev`, `npm run dev`.
- Tests: `npm run ci`. DB-Integrationstests (Test-DB via Docker) folgen mit M2/M3.
- Offen: M2 ist blockiert, bis das echte map.sql-Spaltenformat verifiziert ist (Sandbox-Netz blockiert den Travian-Host).
- Produktiv-Domain: `humans-travian.com` (APP_URL=https://humans-travian.com; Reverse-Proxy/TLS auf dem VPS vor `app:3000`, WebSocket-Upgrade für `/socket.io` durchreichen).
