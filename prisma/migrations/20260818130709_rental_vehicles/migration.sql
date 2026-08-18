-- CreateEnum
CREATE TYPE "rental"."RateUnit" AS ENUM ('Day', 'Week');

-- CreateEnum
CREATE TYPE "rental"."VehicleStatus" AS ENUM ('Registered', 'Available', 'Reserved', 'CheckedOut', 'Maintenance', 'OutOfService');

-- CreateEnum
CREATE TYPE "rental"."VehicleDocumentType" AS ENUM ('PropertyCard', 'Insurance', 'CirculationPermit');

-- CreateEnum
CREATE TYPE "rental"."VehicleDocumentStatus" AS ENUM ('Pending', 'Verified', 'Expired');

-- CreateEnum
CREATE TYPE "rental"."MaintenanceType" AS ENUM ('Preventive', 'Corrective');

-- CreateEnum
CREATE TYPE "rental"."MaintenanceStatus" AS ENUM ('Scheduled', 'InProgress', 'Completed');

-- CreateTable
CREATE TABLE "rental"."vehicle_categories" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vehicle_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."rates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_category_id" UUID NOT NULL,
    "amount_minor_units" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "unit" "rental"."RateUnit" NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."vehicles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "vehicle_category_id" UUID NOT NULL,
    "license_plate" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "status" "rental"."VehicleStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."vehicle_documents" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "document_type" "rental"."VehicleDocumentType" NOT NULL,
    "file_id" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "status" "rental"."VehicleDocumentStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."maintenance_records" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "type" "rental"."MaintenanceType" NOT NULL,
    "status" "rental"."MaintenanceStatus" NOT NULL,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "fit_for_service" BOOLEAN,
    "responsible_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_categories_company_id_name_key" ON "rental"."vehicle_categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "vehicles_company_id_branch_id_status_idx" ON "rental"."vehicles"("company_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "vehicles_company_id_vehicle_category_id_idx" ON "rental"."vehicles"("company_id", "vehicle_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_company_id_license_plate_key" ON "rental"."vehicles"("company_id", "license_plate");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_company_id_vin_key" ON "rental"."vehicles"("company_id", "vin");

-- AddForeignKey
ALTER TABLE "rental"."rates" ADD CONSTRAINT "rates_vehicle_category_id_fkey" FOREIGN KEY ("vehicle_category_id") REFERENCES "rental"."vehicle_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."vehicles" ADD CONSTRAINT "vehicles_vehicle_category_id_fkey" FOREIGN KEY ("vehicle_category_id") REFERENCES "rental"."vehicle_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "rental"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "rental"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- docs/persistence/05-INDICES-Y-CONSTRAINTS.md: segunda capa de defensa (CHECK) sobre las
-- mismas invariantes de rango ya validadas en el dominio (Rate.create()/
-- MaintenanceRecord.schedule()), mismo patron que reservations/availability_slots.
ALTER TABLE "rental"."rates"
  ADD CONSTRAINT "rates_valid_to_after_valid_from_check"
  CHECK (valid_to IS NULL OR valid_to > valid_from);

ALTER TABLE "rental"."maintenance_records"
  ADD CONSTRAINT "maintenance_records_window_check"
  CHECK (scheduled_end > scheduled_start);

ALTER TABLE "rental"."rates"
  ADD CONSTRAINT "rates_amount_non_negative_check"
  CHECK (amount_minor_units >= 0);

-- docs/persistence/05-INDICES-Y-CONSTRAINTS.md: un documento activo (Pending/Verified) por
-- tipo, por vehiculo - mismo patron que identity_documents pero sin propietario
-- polimorfico (VehicleDocument siempre pertenece a un unico Vehicle).
CREATE UNIQUE INDEX "vehicle_documents_vehicle_id_document_type_active_key"
  ON "rental"."vehicle_documents" (vehicle_id, document_type)
  WHERE status IN ('Pending', 'Verified');

-- INV-010/RN-20: ningun par de Rate de la misma vehicle_category_id puede tener vigencias
-- solapadas. btree_gist combina igualdad de UUID con solapamiento de rango de tiempo -
-- primera vez que este repo lo necesita (scheduling.availability_slots tampoco esta
-- construida todavia, docs/persistence/07-MIGRACIONES.md §3).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- tsrange(valid_from, valid_to, '[)') con valid_to NULL construye un rango sin cota
-- superior (comportamiento nativo de Postgres para bound NULL) - exactamente la semantica
-- de vigencia abierta que INV-010/RN-20 necesitan.
ALTER TABLE "rental"."rates"
  ADD CONSTRAINT "rates_no_overlapping_validity"
  EXCLUDE USING gist (
    vehicle_category_id WITH =,
    tsrange(valid_from, valid_to, '[)') WITH &&
  );
