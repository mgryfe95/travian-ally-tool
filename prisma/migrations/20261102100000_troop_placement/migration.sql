-- Manuell angegebene eigene Truppen in anderen Dörfern
CREATE TABLE "TroopPlacement" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "villageId" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TroopPlacement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TroopPlacement_villageId_idx" ON "TroopPlacement"("villageId");
CREATE INDEX "TroopPlacement_userId_idx" ON "TroopPlacement"("userId");
