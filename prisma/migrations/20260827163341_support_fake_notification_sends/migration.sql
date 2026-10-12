-- CreateTable
CREATE TABLE "support"."fake_notification_sends" (
    "id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "recipient_email" TEXT,
    "recipient_phone" TEXT,
    "template_params" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fake_notification_sends_pkey" PRIMARY KEY ("id")
);
