CREATE TABLE "DmThread" (
    "id" SERIAL NOT NULL,
    "pairKey" TEXT NOT NULL,
    "userA" TEXT NOT NULL,
    "userB" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DmThread_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DmThread_pairKey_key" ON "DmThread"("pairKey");
CREATE INDEX "DmThread_userA_idx" ON "DmThread"("userA");
CREATE INDEX "DmThread_userB_idx" ON "DmThread"("userB");

CREATE TABLE "DmMessage" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DmMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DmMessage_threadId_id_idx" ON "DmMessage"("threadId", "id");
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DmThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DmRead" (
    "userId" TEXT NOT NULL,
    "threadId" INTEGER NOT NULL,
    "lastReadMsgId" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DmRead_pkey" PRIMARY KEY ("userId","threadId")
);

CREATE TABLE "Broadcast" (
    "id" SERIAL NOT NULL,
    "senderId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BroadcastRecipient" (
    "broadcastId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("broadcastId","userId")
);
CREATE INDEX "BroadcastRecipient_userId_readAt_idx" ON "BroadcastRecipient"("userId", "readAt");
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rechte: messenger.use (Mitglieder, Moderatoren, Admin), messenger.broadcast (Moderator, Admin); nur wenn die Matrix schon geseedet ist
INSERT INTO "RolePermission" ("role", "permission")
SELECT r, 'messenger.use' FROM (VALUES ('MEMBER'), ('MODERATOR'), ('ADMIN')) AS v(r) WHERE EXISTS (SELECT 1 FROM "RolePermission")
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("role", "permission")
SELECT r, 'messenger.broadcast' FROM (VALUES ('MODERATOR'), ('ADMIN')) AS v(r) WHERE EXISTS (SELECT 1 FROM "RolePermission")
ON CONFLICT DO NOTHING;
