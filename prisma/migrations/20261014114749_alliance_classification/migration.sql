-- CreateEnum
CREATE TYPE "AllianceRelation" AS ENUM ('OWN', 'ALLIED', 'NAP', 'NEUTRAL', 'ENEMY');

-- CreateTable
CREATE TABLE "AllianceClassification" (
    "allianceId" INTEGER NOT NULL,
    "relation" "AllianceRelation" NOT NULL,
    "note" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllianceClassification_pkey" PRIMARY KEY ("allianceId")
);
