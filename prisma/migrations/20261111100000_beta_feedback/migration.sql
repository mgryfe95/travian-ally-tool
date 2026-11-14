-- Beta-Feedback: Kommentare zu HTML-Elementen
ALTER TABLE "User" ADD COLUMN "betaTester" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "FeedbackThread" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    CONSTRAINT "FeedbackThread_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeedbackThread_path_selector_idx" ON "FeedbackThread"("path", "selector");
CREATE INDEX "FeedbackThread_status_idx" ON "FeedbackThread"("status");
CREATE TABLE "FeedbackComment" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeedbackComment_threadId_id_idx" ON "FeedbackComment"("threadId", "id");
ALTER TABLE "FeedbackComment" ADD CONSTRAINT "FeedbackComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "FeedbackThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
