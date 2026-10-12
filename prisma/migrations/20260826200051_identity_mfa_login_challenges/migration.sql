-- CreateEnum
CREATE TYPE "identity"."mfa_login_challenge_status" AS ENUM ('Pending', 'Verified', 'Expired');

-- CreateTable
CREATE TABLE "identity"."mfa_login_challenges" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "identity"."mfa_login_challenge_status" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "mfa_login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mfa_login_challenges_company_user_created_idx" ON "identity"."mfa_login_challenges"("company_id", "user_id", "created_at");

-- AddForeignKey
ALTER TABLE "identity"."mfa_login_challenges" ADD CONSTRAINT "mfa_login_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
