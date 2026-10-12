-- CreateEnum
CREATE TYPE "organization"."PaymentMethod" AS ENUM ('Card', 'Cash', 'Transfer', 'DigitalWallet');

-- CreateTable
CREATE TABLE "organization"."company_settings" (
    "company_id" UUID NOT NULL,
    "enabled_product_modules" TEXT[],
    "payment_methods_enabled" "organization"."PaymentMethod"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("company_id")
);
