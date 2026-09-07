-- CreateEnum
CREATE TYPE "identity"."password_reset_challenge_status" AS ENUM ('Pending', 'Verified', 'Expired');

-- CreateTable
CREATE TABLE "identity"."password_reset_challenges" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "identity"."password_reset_challenge_status" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "password_reset_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_challenges_token_hash_key" ON "identity"."password_reset_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_challenges_company_user_created_idx" ON "identity"."password_reset_challenges"("company_id", "user_id", "created_at");

-- AddForeignKey
ALTER TABLE "identity"."password_reset_challenges" ADD CONSTRAINT "password_reset_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
