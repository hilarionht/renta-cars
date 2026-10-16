-- docs/persistence/10-DECISIONES.md #140: GET /audit-log pagina por cursor en orden de registro
-- (id v7 desc) dentro de la company.
CREATE INDEX "audit_log_company_id_idx" ON "support"."audit_log"("company_id", "id" DESC);
