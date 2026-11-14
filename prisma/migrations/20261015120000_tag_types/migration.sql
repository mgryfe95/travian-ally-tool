CREATE TABLE "TagType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "multi" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "forTaskforces" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TagType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TagType_name_key" ON "TagType"("name");

CREATE TABLE "ChannelTagType" (
    "channelId" INTEGER NOT NULL,
    "tagTypeId" INTEGER NOT NULL,
    CONSTRAINT "ChannelTagType_pkey" PRIMARY KEY ("channelId","tagTypeId")
);
ALTER TABLE "ChannelTagType" ADD CONSTRAINT "ChannelTagType_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelTagType" ADD CONSTRAINT "ChannelTagType_tagTypeId_fkey" FOREIGN KEY ("tagTypeId") REFERENCES "TagType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestehende Tags wandern in den Standard-Typ „Kategorie“ (Einzelauswahl), der in allen Allianz-Kanälen angeboten wird.
INSERT INTO "TagType" ("name", "multi", "required", "forTaskforces", "sortOrder") VALUES ('Kategorie', false, false, true, 0);
ALTER TABLE "Tag" ADD COLUMN "tagTypeId" INTEGER;
UPDATE "Tag" SET "tagTypeId" = (SELECT "id" FROM "TagType" WHERE "name" = 'Kategorie');
ALTER TABLE "Tag" ALTER COLUMN "tagTypeId" SET NOT NULL;
DROP INDEX "Tag_name_key";
CREATE UNIQUE INDEX "Tag_tagTypeId_name_key" ON "Tag"("tagTypeId", "name");
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_tagTypeId_fkey" FOREIGN KEY ("tagTypeId") REFERENCES "TagType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "ChannelTagType" ("channelId", "tagTypeId") SELECT c."id", t."id" FROM "Channel" c, "TagType" t WHERE c."tree" = 'ALLY';
