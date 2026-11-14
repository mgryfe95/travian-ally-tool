CREATE TABLE "MemoryDoc" (
  "id" SERIAL NOT NULL,
  "ownerId" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'user',
  "sourceType" TEXT NOT NULL,
  "sourceId" INTEGER,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("body", ''))) STORED,
  CONSTRAINT "MemoryDoc_pkey" PRIMARY KEY ("id"),
  -- Nutzer-Einträge haben immer einen Besitzer, globale nie
  CONSTRAINT "MemoryDoc_scope_owner" CHECK (("scope" = 'user' AND "ownerId" IS NOT NULL) OR ("scope" = 'global' AND "ownerId" IS NULL))
);
CREATE UNIQUE INDEX "MemoryDoc_sourceType_sourceId_key" ON "MemoryDoc"("sourceType", "sourceId");
CREATE INDEX "MemoryDoc_ownerId_idx" ON "MemoryDoc"("ownerId");
CREATE INDEX "MemoryDoc_tsv_idx" ON "MemoryDoc" USING GIN ("tsv");

-- Eigene Rolle ohne BYPASSRLS: Die App verbindet sich (Docker-Postgres) als Superuser, für den RLS nie gilt.
-- Zugriffe laufen deshalb in einer Transaktion mit SET LOCAL ROLE ally_memory + app.user_id (siehe lib/services/memory.ts).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ally_memory') THEN CREATE ROLE ally_memory NOLOGIN NOBYPASSRLS; END IF;
END $$;
GRANT ally_memory TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO ally_memory;
GRANT SELECT, INSERT, UPDATE, DELETE ON "MemoryDoc" TO ally_memory;
GRANT USAGE, SELECT ON SEQUENCE "MemoryDoc_id_seq" TO ally_memory;

ALTER TABLE "MemoryDoc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemoryDoc" FORCE ROW LEVEL SECURITY;
-- Lesen: eigene Einträge ODER globale. Schreiben: nur eigene Nutzer-Einträge.
CREATE POLICY memory_read ON "MemoryDoc" FOR SELECT TO ally_memory
  USING ("scope" = 'global' OR "ownerId" = current_setting('app.user_id', true));
CREATE POLICY memory_insert ON "MemoryDoc" FOR INSERT TO ally_memory
  WITH CHECK ("scope" = 'user' AND "ownerId" = current_setting('app.user_id', true));
CREATE POLICY memory_update ON "MemoryDoc" FOR UPDATE TO ally_memory
  USING ("scope" = 'user' AND "ownerId" = current_setting('app.user_id', true))
  WITH CHECK ("scope" = 'user' AND "ownerId" = current_setting('app.user_id', true));
CREATE POLICY memory_delete ON "MemoryDoc" FOR DELETE TO ally_memory
  USING ("scope" = 'user' AND "ownerId" = current_setting('app.user_id', true));
