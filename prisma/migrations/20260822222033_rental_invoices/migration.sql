-- CreateEnum
CREATE TYPE "rental"."ChargeKind" AS ENUM ('RentalFee', 'Extension', 'Penalty', 'Damage', 'Fuel');

-- CreateEnum
CREATE TYPE "rental"."InvoiceStatus" AS ENUM ('Issued', 'Voided');

-- CreateTable
CREATE TABLE "rental"."invoices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "rental"."InvoiceStatus" NOT NULL,
    "tax_amount_minor_units" INTEGER NOT NULL DEFAULT 0,
    "void_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."charges" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "kind" "rental"."ChargeKind" NOT NULL,
    "amount_minor_units" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."invoice_number_sequences" (
    "company_id" UUID NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_number_sequences_pkey" PRIMARY KEY ("company_id")
);

-- CreateIndex
CREATE INDEX "invoices_company_id_reservation_id_idx" ON "rental"."invoices"("company_id", "reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_company_id_invoice_number_key" ON "rental"."invoices"("company_id", "invoice_number");

-- AddForeignKey
ALTER TABLE "rental"."invoices" ADD CONSTRAINT "invoices_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "rental"."reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "rental"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."charges" ADD CONSTRAINT "charges_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "rental"."invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- docs/model/07-INVARIANTS.md INV-023: una Invoice emitida una unica vez por Reservation,
-- salvo el caso excepcional de anulacion + reemision (una nueva Invoice referenciando la
-- anulada) - un UNIQUE simple sobre reservation_id rompería exactamente ese caso de
-- excepcion, se necesita un indice unico PARCIAL (solo entre filas activas). No expresable
-- en el DSL de Prisma, se agrega a mano, mismo criterio que el CHECK de INV-019 en Payments.
CREATE UNIQUE INDEX "invoices_reservation_id_active_key" ON "rental"."invoices"("reservation_id") WHERE "status" != 'Voided';
