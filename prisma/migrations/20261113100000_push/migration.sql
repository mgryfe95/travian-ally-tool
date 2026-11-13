CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOkAt" TIMESTAMP(3),
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

CREATE TABLE "NotifyPref" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "on" BOOLEAN NOT NULL,
    CONSTRAINT "NotifyPref_pkey" PRIMARY KEY ("userId","key")
);
