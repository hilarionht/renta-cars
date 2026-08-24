-- CreateIndex
CREATE INDEX "sessions_company_user_status_idx" ON "identity"."sessions"("company_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "branches_company_id_idx" ON "organization"."branches"("company_id");

-- Prisma no modela indices parciales (docs/persistence/05-INDICES-Y-CONSTRAINTS.md SS2) - el
-- diff generado automaticamente confundio el @@index([companyId, status]) nuevo (cobertura
-- general, cualquier status) con el indice parcial ya existente
-- reservations_company_id_status_draft_idx (WHERE status='Draft', solo para el job de
-- expiracion de Drafts) y propuso renombrarlo en vez de crear uno nuevo - corregido a mano:
-- el parcial existente NO se toca, se crea un indice completo distinto.
-- CreateIndex
CREATE INDEX "reservations_company_status_idx" ON "rental"."reservations"("company_id", "status");
