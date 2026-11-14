CREATE TABLE "TaskforceInvite" (
    "id" SERIAL NOT NULL,
    "taskforceId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    CONSTRAINT "TaskforceInvite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskforceInvite_userId_status_idx" ON "TaskforceInvite"("userId", "status");
CREATE INDEX "TaskforceInvite_taskforceId_status_idx" ON "TaskforceInvite"("taskforceId", "status");
ALTER TABLE "TaskforceInvite" ADD CONSTRAINT "TaskforceInvite_taskforceId_fkey" FOREIGN KEY ("taskforceId") REFERENCES "Taskforce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Der Ersteller einer Task-Force ist der Gründer.
UPDATE "TaskforceMember" m SET "role" = 'founder' FROM "Taskforce" t WHERE t."id" = m."taskforceId" AND t."createdBy" = m."userId";
