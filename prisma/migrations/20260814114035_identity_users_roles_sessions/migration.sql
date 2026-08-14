-- CreateEnum
CREATE TYPE "identity"."user_status" AS ENUM ('Active', 'Disabled');

-- CreateEnum
CREATE TYPE "identity"."role_scope" AS ENUM ('System', 'Custom');

-- CreateEnum
CREATE TYPE "identity"."role_status" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "identity"."session_status" AS ENUM ('Active', 'Rotated', 'Revoked');

-- CreateTable
CREATE TABLE "identity"."users" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "identity"."user_status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."roles" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "role_name" TEXT NOT NULL,
    "scope" "identity"."role_scope" NOT NULL,
    "status" "identity"."role_status" NOT NULL,
    "permissions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "identity"."sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_user_agent" TEXT,
    "device_ip_address" TEXT,
    "status" "identity"."session_status" NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_company_id_email_key" ON "identity"."users"("company_id", "email");

-- CreateIndex
CREATE INDEX "roles_role_name_idx" ON "identity"."roles"("role_name");

-- Partial unique indexes (docs/persistence/08-PRISMA-CONVENTIONS.md: no expresable en el
-- DSL de Prisma, agregado a mano) - roles_role_name_idx de arriba cubre performance de
-- lookup, estos dos cubren la unicidad real segun scope (docs/persistence/
-- 05-INDICES-Y-CONSTRAINTS.md).
CREATE UNIQUE INDEX "roles_role_name_system_key" ON "identity"."roles"("role_name") WHERE "scope" = 'System';
CREATE UNIQUE INDEX "roles_company_id_role_name_custom_key" ON "identity"."roles"("company_id", "role_name") WHERE "scope" = 'Custom';

-- CHECK: el conjunto de permisos nunca puede quedar vacio (model/02-AGGREGATES.md §2).
ALTER TABLE "identity"."roles" ADD CONSTRAINT "roles_permissions_not_empty" CHECK (cardinality("permissions") > 0);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "identity"."sessions"("refresh_token_hash");

-- AddForeignKey
ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
