-- CreateEnum
CREATE TYPE "support"."UploadStatus" AS ENUM ('Uploaded', 'Deleted');

-- CreateTable
CREATE TABLE "support"."files" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "storage_ref" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "upload_status" "support"."UploadStatus" NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_ref_key" ON "support"."files"("storage_ref");

-- CreateIndex
CREATE INDEX "files_company_created_idx" ON "support"."files"("company_id", "created_at" DESC);
