ALTER TABLE "Message" ADD COLUMN "replyToId" INTEGER;
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Mention" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Mention_messageId_userId_key" ON "Mention"("messageId", "userId");
CREATE INDEX "Mention_userId_messageId_idx" ON "Mention"("userId", "messageId");
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
