ALTER TABLE "Attachment" ADD COLUMN "dmMessageId" INTEGER;
CREATE INDEX "Attachment_dmMessageId_idx" ON "Attachment"("dmMessageId");
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_dmMessageId_fkey" FOREIGN KEY ("dmMessageId") REFERENCES "DmMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DmMessage_authorId_id_idx" ON "DmMessage"("authorId", "id");
