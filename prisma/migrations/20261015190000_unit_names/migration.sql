CREATE TABLE "UnitName" (
    "tribeVid" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameDe" TEXT,
    "gameVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnitName_pkey" PRIMARY KEY ("tribeVid","slot")
);
