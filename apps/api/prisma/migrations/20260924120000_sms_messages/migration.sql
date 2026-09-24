-- Outgoing SMS notifications: written with the business event, delivered by a
-- dispatcher through the configured gateway, retried on failure. Login codes
-- are never stored here.

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "sms_messages" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "tokens" JSONB NOT NULL DEFAULT '[]',
    "status" "SmsStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_messages_status_createdAt_idx" ON "sms_messages"("status", "createdAt");

-- CreateIndex
CREATE INDEX "sms_messages_userId_createdAt_idx" ON "sms_messages"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

