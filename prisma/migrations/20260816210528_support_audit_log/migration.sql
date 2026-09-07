-- CreateTable
CREATE TABLE "support"."audit_log" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "actor_ref" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_company_occurred_idx" ON "support"."audit_log"("company_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_subject_occurred_idx" ON "support"."audit_log"("subject_type", "subject_id", "occurred_at" DESC);
