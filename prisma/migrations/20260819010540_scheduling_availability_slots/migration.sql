-- CreateEnum
CREATE TYPE "scheduling"."SlotStatus" AS ENUM ('Active', 'Released');

-- CreateEnum
CREATE TYPE "scheduling"."SlotType" AS ENUM ('Booking', 'Blackout');

-- CreateTable
CREATE TABLE "scheduling"."availability_slots" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "slot_type" "scheduling"."SlotType" NOT NULL,
    "reference_id" TEXT,
    "reason" TEXT,
    "status" "scheduling"."SlotStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_slots_company_id_resource_type_resource_id_idx" ON "scheduling"."availability_slots"("company_id", "resource_type", "resource_id");

-- docs/persistence/05-INDICES-Y-CONSTRAINTS.md SS6: CHECK de rango, segunda capa mecanica
-- (junto con reservations/rates) sobre toda tabla que porte un rango de fechas.
ALTER TABLE "scheduling"."availability_slots"
  ADD CONSTRAINT "availability_slots_end_after_start_check"
  CHECK (end_date > start_date);

-- INV-013/INV-102 (docs/model/07-INVARIANTS.md): ningun par de AvailabilitySlot Active del
-- mismo (resource_type, resource_id) puede tener rangos de fecha que se solapen. btree_gist
-- combina la igualdad de (resource_type, resource_id) con el operador de solapamiento de
-- rango - segunda vez que este repo lo necesita (la primera fue rates, Vehicles); se agrega
-- de nuevo aca de forma idempotente (IF NOT EXISTS) para que esta migracion sea autocontenida
-- y no dependa de que la de Vehicles ya haya corrido (docs/persistence/07-MIGRACIONES.md SS1:
-- "una migracion, un schema").
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- PARCIAL (WHERE status = 'Active') - a diferencia de la de rates (sin condicion parcial),
-- los slots Released SI pueden solaparse entre si en el historico
-- (docs/persistence/05-INDICES-Y-CONSTRAINTS.md SS5, tabla comparativa explicita).
ALTER TABLE "scheduling"."availability_slots"
  ADD CONSTRAINT "availability_slots_no_overlapping_active"
  EXCLUDE USING gist (
    resource_type WITH =,
    resource_id WITH =,
    tsrange(start_date, end_date, '[)') WITH &&
  )
  WHERE (status = 'Active');
