CREATE TABLE "VisionExample" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "gold" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionExample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VisionExample_kind_createdAt_idx" ON "VisionExample"("kind", "createdAt");
CREATE TABLE "VisionAlias" (
    "id" SERIAL NOT NULL,
    "term" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VisionAlias_term_key" ON "VisionAlias"("term");
