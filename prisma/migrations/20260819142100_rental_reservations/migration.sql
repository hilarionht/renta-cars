-- CreateEnum
CREATE TYPE "rental"."ReservationStatus" AS ENUM ('Draft', 'Confirmed', 'CheckedOut', 'CheckedIn', 'Closed', 'Cancelled');

-- CreateEnum
CREATE TYPE "rental"."InspectionType" AS ENUM ('CheckOut', 'CheckIn');

-- CreateEnum
CREATE TYPE "rental"."DamageSeverity" AS ENUM ('Minor', 'Severe');

-- CreateEnum
CREATE TYPE "rental"."PriceAdjustmentKind" AS ENUM ('Extension', 'LateReturnPenalty', 'DamagePenalty', 'FuelDifference', 'CancellationPenalty');

-- Prisma genero automaticamente 7 ALTER COLUMN ... DROP DEFAULT sobre
-- organization.company_settings aca (porque el schema.prisma no declara @default a nivel
-- de columna) - se omiten a proposito: la migracion anterior
-- (20260819124604_organization_company_settings_reservation_policies) dejo esos DEFAULT en
-- la columna deliberadamente, como red de seguridad para cualquier INSERT que no pase por
-- CompanySettings.create() (ver comentario en esa migracion), no como un valor de negocio
-- que el dominio deba decidir.

-- AlterTable
ALTER TABLE "rental"."maintenance_records" ADD COLUMN     "damage_report_id" UUID;

-- CreateTable
CREATE TABLE "rental"."reservations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "status" "rental"."ReservationStatus" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "base_amount_minor_units" INTEGER NOT NULL,
    "base_amount_currency" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."inspections" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "type" "rental"."InspectionType" NOT NULL,
    "odometer" INTEGER NOT NULL,
    "fuel_level" INTEGER NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL,
    "inspected_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."inspection_photos" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."damage_reports" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "rental"."DamageSeverity" NOT NULL,
    "imputable_to_customer" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."damage_report_photos" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "damage_report_id" UUID NOT NULL,
    "file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damage_report_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."price_adjustments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "kind" "rental"."PriceAdjustmentKind" NOT NULL,
    "amount_minor_units" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."reservation_authorized_drivers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "additional_driver_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_authorized_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_company_id_vehicle_id_status_idx" ON "rental"."reservations"("company_id", "vehicle_id", "status");

-- CreateIndex
CREATE INDEX "reservations_company_id_customer_id_status_idx" ON "rental"."reservations"("company_id", "customer_id", "status");

-- Indice parcial (docs/persistence/05-INDICES-Y-CONSTRAINTS.md §2) - "reservas activas de
-- este vehiculo"/soporte del futuro job de expiracion de Draft (RN-05) sin escanear
-- reservas ya resueltas. No expresable en el DSL de Prisma (sin clausula WHERE en
-- @@index), se agrega a mano.
CREATE INDEX "reservations_company_id_status_draft_idx" ON "rental"."reservations"("company_id", "status") WHERE "status" = 'Draft';

-- CHECK: endDate estrictamente posterior a startDate (RN-03/INV-001) - mismo segundo-capa
-- ya usado en availability_slots/rates (docs/persistence/10-DECISIONES.md #9).
ALTER TABLE "rental"."reservations" ADD CONSTRAINT "reservations_end_after_start_check" CHECK ("end_date" > "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_reservation_id_type_key" ON "rental"."inspections"("reservation_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_photos_inspection_id_file_id_key" ON "rental"."inspection_photos"("inspection_id", "file_id");

-- CreateIndex
CREATE UNIQUE INDEX "damage_report_photos_damage_report_id_file_id_key" ON "rental"."damage_report_photos"("damage_report_id", "file_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_authorized_drivers_reservation_id_additional_dr_key" ON "rental"."reservation_authorized_drivers"("reservation_id", "additional_driver_id");

-- AddForeignKey
ALTER TABLE "rental"."maintenance_records" ADD CONSTRAINT "maintenance_records_damage_report_id_fkey" FOREIGN KEY ("damage_report_id") REFERENCES "rental"."damage_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."reservations" ADD CONSTRAINT "reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "rental"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."reservations" ADD CONSTRAINT "reservations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "rental"."vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."inspections" ADD CONSTRAINT "inspections_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "rental"."reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "rental"."inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."damage_reports" ADD CONSTRAINT "damage_reports_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "rental"."reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."damage_reports" ADD CONSTRAINT "damage_reports_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "rental"."inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."damage_report_photos" ADD CONSTRAINT "damage_report_photos_damage_report_id_fkey" FOREIGN KEY ("damage_report_id") REFERENCES "rental"."damage_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."price_adjustments" ADD CONSTRAINT "price_adjustments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "rental"."reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."reservation_authorized_drivers" ADD CONSTRAINT "reservation_authorized_drivers_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "rental"."reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."reservation_authorized_drivers" ADD CONSTRAINT "reservation_authorized_drivers_additional_driver_id_fkey" FOREIGN KEY ("additional_driver_id") REFERENCES "rental"."additional_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
