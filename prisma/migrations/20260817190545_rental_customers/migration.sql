-- CreateEnum
CREATE TYPE "rental"."CustomerType" AS ENUM ('Individual', 'Corporate');

-- CreateEnum
CREATE TYPE "rental"."CustomerStatus" AS ENUM ('Registered', 'Active');

-- CreateEnum
CREATE TYPE "rental"."CustomerBlockStatus" AS ENUM ('None', 'Blocked');

-- CreateEnum
CREATE TYPE "rental"."DocumentType" AS ENUM ('NationalId', 'DriversLicense');

-- CreateEnum
CREATE TYPE "rental"."IdentityDocumentStatus" AS ENUM ('Pending', 'Verified', 'Expired');

-- CreateEnum
CREATE TYPE "rental"."AdditionalDriverStatus" AS ENUM ('Registered', 'Validated', 'Revoked');

-- CreateTable
CREATE TABLE "rental"."customers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id_or_document_id" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "customer_type" "rental"."CustomerType" NOT NULL,
    "status" "rental"."CustomerStatus" NOT NULL,
    "block_status" "rental"."CustomerBlockStatus" NOT NULL,
    "block_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."identity_documents" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID,
    "additional_driver_id" UUID,
    "document_type" "rental"."DocumentType" NOT NULL,
    "file_id" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "status" "rental"."IdentityDocumentStatus" NOT NULL,
    "extracted_by_ocr" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental"."additional_drivers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "rental"."AdditionalDriverStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "additional_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_tax_id_or_document_id_key" ON "rental"."customers"("company_id", "tax_id_or_document_id");

-- AddForeignKey
ALTER TABLE "rental"."identity_documents" ADD CONSTRAINT "identity_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "rental"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."identity_documents" ADD CONSTRAINT "identity_documents_additional_driver_id_fkey" FOREIGN KEY ("additional_driver_id") REFERENCES "rental"."additional_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental"."additional_drivers" ADD CONSTRAINT "additional_drivers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "rental"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- docs/persistence/03-RELACIONES.md §5: propietario polimorfico de identity_documents,
-- exactamente uno de customer_id/additional_driver_id poblado, nunca ambos ni ninguno.
-- Alternativa descartada en los docs: una columna generica owner_type/owner_id sin FK real -
-- se prefirio conservar la integridad referencial real dentro del mismo schema.
ALTER TABLE "rental"."identity_documents"
  ADD CONSTRAINT "identity_documents_owner_exclusive_check"
  CHECK (
    (customer_id IS NOT NULL AND additional_driver_id IS NULL)
    OR (customer_id IS NULL AND additional_driver_id IS NOT NULL)
  );

-- docs/persistence/05-INDICES-Y-CONSTRAINTS.md: un documento activo (Pending/Verified) por
-- tipo, por propietario polimorfico. COALESCE porque Prisma no expresa indices por
-- expresion declarativamente - el owner es siempre exactamente una de las 2 columnas.
CREATE UNIQUE INDEX "identity_documents_owner_document_type_active_key"
  ON "rental"."identity_documents" (COALESCE(customer_id, additional_driver_id), document_type)
  WHERE status IN ('Pending', 'Verified');

-- docs/persistence/05-INDICES-Y-CONSTRAINTS.md: listado administrativo de clientes
-- bloqueados sin escanear la mayoria (no bloqueados).
CREATE INDEX "customers_company_id_block_status_idx"
  ON "rental"."customers" (company_id, block_status) WHERE block_status = 'Blocked';
