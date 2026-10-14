-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiInstructions" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "VillageProfile" (
    "villageId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "aiInstructions" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageProfile_pkey" PRIMARY KEY ("villageId","userId")
);

-- CreateTable
CREATE TABLE "VillageState" (
    "villageId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "resources" JSONB,
    "fields" JSONB,
    "buildings" JSONB,
    "troops" JSONB,
    "queues" JSONB,
    "resourcesAt" TIMESTAMP(3),
    "buildingsAt" TIMESTAMP(3),
    "troopsAt" TIMESTAMP(3),
    "sourceScreenshotId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageState_pkey" PRIMARY KEY ("villageId")
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "villageId" INTEGER,
    "detectedKind" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "detectedDevice" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DOUBLE PRECISION,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "parsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameDataVersion" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverSpeed" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "GameDataVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tribe" (
    "id" SERIAL NOT NULL,
    "versionId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "traits" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Tribe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" SERIAL NOT NULL,
    "versionId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tribeRestriction" TEXT,
    "maxLevel" INTEGER NOT NULL,
    "prerequisites" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingLevel" (
    "buildingId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "costWood" INTEGER NOT NULL,
    "costClay" INTEGER NOT NULL,
    "costIron" INTEGER NOT NULL,
    "costCrop" INTEGER NOT NULL,
    "upkeep" INTEGER NOT NULL,
    "buildTimeSec" INTEGER NOT NULL,
    "culturePoints" INTEGER NOT NULL,
    "effects" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "BuildingLevel_pkey" PRIMARY KEY ("buildingId","level")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" SERIAL NOT NULL,
    "versionId" INTEGER NOT NULL,
    "tribeId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attack" INTEGER NOT NULL,
    "defInf" INTEGER NOT NULL,
    "defCav" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "carry" INTEGER NOT NULL,
    "costWood" INTEGER NOT NULL,
    "costClay" INTEGER NOT NULL,
    "costIron" INTEGER NOT NULL,
    "costCrop" INTEGER NOT NULL,
    "upkeep" INTEGER NOT NULL,
    "trainTimeSec" INTEGER NOT NULL,
    "building" TEXT NOT NULL,
    "researchReq" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VillageState_userId_idx" ON "VillageState"("userId");

-- CreateIndex
CREATE INDEX "Screenshot_userId_createdAt_idx" ON "Screenshot"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tribe_versionId_key_key" ON "Tribe"("versionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Building_versionId_key_key" ON "Building"("versionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_versionId_tribeId_key_key" ON "Unit"("versionId", "tribeId", "key");

-- AddForeignKey
ALTER TABLE "Tribe" ADD CONSTRAINT "Tribe_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameDataVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameDataVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingLevel" ADD CONSTRAINT "BuildingLevel_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "GameDataVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_tribeId_fkey" FOREIGN KEY ("tribeId") REFERENCES "Tribe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
