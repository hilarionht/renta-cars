-- AlterTable
ALTER TABLE "identity"."users" ADD COLUMN     "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfa_secret_encrypted" TEXT;
