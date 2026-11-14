-- CreateTable
CREATE TABLE "Snapshot" (
    "id" SERIAL NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillageSnapshot" (
    "snapshotId" INTEGER NOT NULL,
    "villageId" INTEGER NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "tribe" INTEGER NOT NULL,
    "villageName" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "allianceName" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "extra" JSONB NOT NULL,

    CONSTRAINT "VillageSnapshot_pkey" PRIMARY KEY ("snapshotId","villageId")
);

-- CreateTable
CREATE TABLE "Alliance" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "villageCount" INTEGER NOT NULL,
    "population" INTEGER NOT NULL,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tribe" INTEGER NOT NULL,
    "allianceId" INTEGER NOT NULL,
    "population" INTEGER NOT NULL,
    "villageCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "noGrowthDays" INTEGER NOT NULL,
    "delta1" INTEGER,
    "delta3" INTEGER,
    "delta7" INTEGER,
    "firstSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Village" (
    "id" INTEGER NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "population" INTEGER NOT NULL,
    "extra" JSONB NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDailyStat" (
    "playerId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "population" INTEGER NOT NULL,
    "villageCount" INTEGER NOT NULL,
    "allianceId" INTEGER NOT NULL,

    CONSTRAINT "PlayerDailyStat_pkey" PRIMARY KEY ("playerId","date")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" INTEGER,
    "otherPlayerId" INTEGER,
    "villageId" INTEGER,
    "data" JSONB,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_hash_key" ON "Snapshot"("hash");

-- CreateIndex
CREATE INDEX "VillageSnapshot_snapshotId_playerId_idx" ON "VillageSnapshot"("snapshotId", "playerId");

-- CreateIndex
CREATE INDEX "Player_allianceId_idx" ON "Player"("allianceId");

-- CreateIndex
CREATE INDEX "Player_status_idx" ON "Player"("status");

-- CreateIndex
CREATE INDEX "Village_playerId_idx" ON "Village"("playerId");

-- CreateIndex
CREATE INDEX "Event_at_idx" ON "Event"("at");

-- CreateIndex
CREATE INDEX "Event_playerId_idx" ON "Event"("playerId");

-- AddForeignKey
ALTER TABLE "VillageSnapshot" ADD CONSTRAINT "VillageSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
