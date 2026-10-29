CREATE TABLE "CallTemplate" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channelId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CallTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CallTemplate_name_key" ON "CallTemplate"("name");

CREATE TABLE "AllianceCall" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "x" INTEGER,
    "y" INTEGER,
    "villageId" INTEGER,
    "villageName" TEXT,
    "playerId" INTEGER,
    "playerName" TEXT,
    "at" TIMESTAMP(3),
    "channelId" INTEGER NOT NULL,
    "template" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "messageId" INTEGER,
    CONSTRAINT "AllianceCall_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AllianceCall_status_at_idx" ON "AllianceCall"("status", "at");

-- Neue Rechte: schedule.view (Mitglieder, Moderatoren, Admin) und schedule.manage (Admin), nur wenn die Matrix schon geseedet ist
INSERT INTO "RolePermission" ("role", "permission")
SELECT r, 'schedule.view' FROM (VALUES ('MEMBER'), ('MODERATOR'), ('ADMIN')) AS v(r) WHERE EXISTS (SELECT 1 FROM "RolePermission")
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("role", "permission")
SELECT 'ADMIN', 'schedule.manage' WHERE EXISTS (SELECT 1 FROM "RolePermission")
ON CONFLICT DO NOTHING;
