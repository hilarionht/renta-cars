-- CreateTable
CREATE TABLE "rental"."reservation_reminder_dispatches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservation_reminder_dispatches_reservation_id_key" ON "rental"."reservation_reminder_dispatches"("reservation_id");

-- AddForeignKey
ALTER TABLE "rental"."reservation_reminder_dispatches" ADD CONSTRAINT "reservation_reminder_dispatches_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "rental"."reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
