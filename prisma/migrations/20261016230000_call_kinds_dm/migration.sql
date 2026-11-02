ALTER TABLE "CallTemplate" ADD COLUMN "sendDm" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AllianceCall" ADD COLUMN "sendDm" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "CallKindDef" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "needsCoords" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CallKindDef_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CallKindDef_name_key" ON "CallKindDef"("name");
