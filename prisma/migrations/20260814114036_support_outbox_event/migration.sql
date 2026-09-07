-- CreateTable
CREATE TABLE "support"."outbox_event" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "company_id" UUID,
    "source_schema" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_event_id_key" ON "support"."outbox_event"("event_id");

-- CreateIndex
CREATE INDEX "outbox_event_published_at_idx" ON "support"."outbox_event"("published_at");
