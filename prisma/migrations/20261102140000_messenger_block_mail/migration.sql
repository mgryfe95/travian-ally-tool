-- Messenger: Blockieren, Mail-Hinweis
CREATE TABLE "DmBlock" (
    "userId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DmBlock_pkey" PRIMARY KEY ("userId","blockedId")
);
ALTER TABLE "DmRead" ADD COLUMN "mailedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "dmMail" BOOLEAN NOT NULL DEFAULT false;
