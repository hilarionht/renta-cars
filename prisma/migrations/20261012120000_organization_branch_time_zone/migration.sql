-- docs/persistence/10-DECISIONES.md #135: zona horaria IANA por sucursal. Las existentes
-- quedan en America/Argentina/Buenos_Aires (default elegido por el usuario).
-- AlterTable
ALTER TABLE "organization"."branches" ADD COLUMN     "time_zone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

-- GET /customers paginado por cursor (orden id desc dentro de la company).
-- CreateIndex
CREATE INDEX "customers_company_id_id_idx" ON "rental"."customers"("company_id", "id");
