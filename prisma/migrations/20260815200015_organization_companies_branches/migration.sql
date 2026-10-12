-- CreateEnum
CREATE TYPE "organization"."CompanyStatus" AS ENUM ('Active', 'Suspended');

-- CreateEnum
CREATE TYPE "organization"."BranchStatus" AS ENUM ('Active', 'Closed');

-- CreateTable
CREATE TABLE "organization"."companies" (
    "id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "tax_id" TEXT NOT NULL,
    "billing_contact_email" TEXT NOT NULL,
    "billing_contact_phone" TEXT,
    "status" "organization"."CompanyStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."branches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "address_city" TEXT NOT NULL,
    "address_state_province" TEXT,
    "address_postal_code" TEXT,
    "address_country" TEXT NOT NULL,
    "operating_hours" JSONB NOT NULL,
    "status" "organization"."BranchStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_tax_id_key" ON "organization"."companies"("tax_id");
