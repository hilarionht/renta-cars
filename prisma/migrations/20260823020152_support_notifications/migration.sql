-- CreateEnum
CREATE TYPE "support"."NotificationChannel" AS ENUM ('WhatsApp', 'Email', 'SMS', 'Push');

-- CreateEnum
CREATE TYPE "support"."NotificationStatus" AS ENUM ('Pending', 'Sent', 'Delivered', 'Failed');

-- CreateEnum
CREATE TYPE "support"."NotificationKind" AS ENUM ('Confirmation', 'Reminder', 'Receipt', 'Alert');

-- CreateTable
CREATE TABLE "support"."notifications" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "kind" "support"."NotificationKind" NOT NULL,
    "status" "support"."NotificationStatus" NOT NULL,
    "recipient_email" TEXT,
    "recipient_phone" TEXT,
    "recipient_device_token" TEXT,
    "template_id" TEXT NOT NULL,
    "channel" "support"."NotificationChannel",
    "provider_reference" TEXT,
    "failure_reason" TEXT,
    "channels_exhausted" BOOLEAN NOT NULL DEFAULT false,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_company_created_idx" ON "support"."notifications"("company_id", "created_at" DESC);
