-- CreateEnum
CREATE TYPE "commerce"."PaymentTargetType" AS ENUM ('Invoice', 'SecurityDeposit');

-- CreateEnum
CREATE TYPE "commerce"."CommercePaymentMethod" AS ENUM ('Card', 'Cash', 'Transfer', 'DigitalWallet');

-- CreateEnum
CREATE TYPE "commerce"."PaymentStatus" AS ENUM ('Requested', 'Authorized', 'Captured', 'Failed', 'Refunded');

-- CreateEnum
CREATE TYPE "commerce"."DepositStatus" AS ENUM ('Held', 'ReleasedFully', 'RetainedPartially', 'RetainedFully');

-- CreateTable
CREATE TABLE "commerce"."payments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "target_type" "commerce"."PaymentTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "amount_minor_units" INTEGER NOT NULL,
    "amount_currency" TEXT NOT NULL,
    "method" "commerce"."CommercePaymentMethod" NOT NULL,
    "status" "commerce"."PaymentStatus" NOT NULL,
    "gateway_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce"."security_deposits" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "amount_minor_units" INTEGER NOT NULL,
    "amount_currency" TEXT NOT NULL,
    "status" "commerce"."DepositStatus" NOT NULL,
    "gateway_hold_reference" TEXT,
    "retained_amount_minor_units" INTEGER,
    "retention_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "security_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_company_id_target_type_target_id_idx" ON "commerce"."payments"("company_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_company_id_idempotency_key_key" ON "commerce"."payments"("company_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "security_deposits_company_id_reservation_id_key" ON "commerce"."security_deposits"("company_id", "reservation_id");

-- docs/model/07-INVARIANTS.md INV-019: el monto retenido nunca excede el monto originalmente
-- retenido. No expresable en el DSL de Prisma (sin @@check en esta version), se agrega a
-- mano, mismo criterio que el CHECK de rango de fechas en scheduling.availability_slots.
ALTER TABLE "commerce"."security_deposits"
  ADD CONSTRAINT "security_deposits_retained_amount_within_held_check"
  CHECK ("retained_amount_minor_units" IS NULL OR "retained_amount_minor_units" <= "amount_minor_units");
