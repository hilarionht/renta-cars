-- docs/persistence/10-DECISIONES.md #145: el recordatorio pasa a "al menos una vez". La fila del
-- despacho tiene estado e intentos. Las filas existentes ya se procesaron (no se sabe si salieron
-- y no se reintentan): quedan Sent, y su ultimo intento es el despacho original.
CREATE TYPE "rental"."ReservationReminderDispatchStatus" AS ENUM ('Sending', 'Sent', 'Failed');

ALTER TABLE "rental"."reservation_reminder_dispatches"
  ADD COLUMN "status" "rental"."ReservationReminderDispatchStatus" NOT NULL DEFAULT 'Sent',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "last_attempt_at" TIMESTAMP(3),
  ADD COLUMN "last_error" TEXT;

UPDATE "rental"."reservation_reminder_dispatches" SET "last_attempt_at" = "dispatched_at";

ALTER TABLE "rental"."reservation_reminder_dispatches"
  ALTER COLUMN "status" SET DEFAULT 'Sending',
  ALTER COLUMN "last_attempt_at" SET NOT NULL,
  ALTER COLUMN "last_attempt_at" SET DEFAULT CURRENT_TIMESTAMP;
