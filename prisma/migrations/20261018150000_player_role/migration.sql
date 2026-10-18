CREATE TABLE "PlayerRole" (
    "travianPlayerId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "setBy" TEXT NOT NULL,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerRole_pkey" PRIMARY KEY ("travianPlayerId")
);
