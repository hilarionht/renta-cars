-- CreateEnum
CREATE TYPE "rental"."customer_session_status" AS ENUM ('Active', 'Rotated', 'Revoked');

-- CreateTable
CREATE TABLE "rental"."customer_sessions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_user_agent" TEXT,
    "device_ip_address" TEXT,
    "status" "rental"."customer_session_status" NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_sessions_refresh_token_hash_key" ON "rental"."customer_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "customer_sessions_company_customer_status_idx" ON "rental"."customer_sessions"("company_id", "customer_id", "status");

-- AddForeignKey
ALTER TABLE "rental"."customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "rental"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
