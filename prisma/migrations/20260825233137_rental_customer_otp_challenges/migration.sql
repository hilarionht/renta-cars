-- CreateEnum
CREATE TYPE "rental"."customer_otp_challenge_status" AS ENUM ('Pending', 'Verified', 'Expired');

-- CreateTable
CREATE TABLE "rental"."customer_otp_challenges" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "status" "rental"."customer_otp_challenge_status" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "customer_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_otp_challenges_company_customer_created_idx" ON "rental"."customer_otp_challenges"("company_id", "customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "rental"."customer_otp_challenges" ADD CONSTRAINT "customer_otp_challenges_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "rental"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
