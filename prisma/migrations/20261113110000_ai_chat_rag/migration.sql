ALTER TABLE "User" ADD COLUMN "aiChatPrompt" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Incident" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'defense',
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "params" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "chatId" INTEGER,
  ADD COLUMN "clarifiedAt" TIMESTAMP(3);
-- Bestehende Incidents gelten als geklärt
UPDATE "Incident" SET "clarifiedAt" = "createdAt", "description" = "notes";

ALTER TABLE "MemoryDoc" ADD COLUMN "embedding" DOUBLE PRECISION[],
  ADD COLUMN "embedModel" TEXT,
  ADD COLUMN "embeddedAt" TIMESTAMP(3);

CREATE TABLE "AiChat" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'chat',
    "title" TEXT NOT NULL DEFAULT '',
    "incidentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiChat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiChat_incidentId_key" ON "AiChat"("incidentId");
CREATE INDEX "AiChat_userId_updatedAt_idx" ON "AiChat"("userId", "updatedAt");

CREATE TABLE "AiChatMessage" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiChatMessage_chatId_id_idx" ON "AiChatMessage"("chatId", "id");
ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "AiChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
