-- Primer uso real del schema commerce - USAGE nunca se otorgo antes.
GRANT USAGE ON SCHEMA commerce TO app_runtime;

-- RLS estandar (docs/persistence/06-RLS.md) - grant completo, no restringido como
-- audit_log. company_id es infraestructura pura (docs/persistence/01-SCHEMAS.md SS4.3), pero
-- la politica de RLS es identica a la de toda otra tabla del modelo.
GRANT SELECT, INSERT, UPDATE, DELETE ON commerce.payments TO app_runtime;
ALTER TABLE commerce.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payments_tenant_isolation ON commerce.payments
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON commerce.security_deposits TO app_runtime;
ALTER TABLE commerce.security_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce.security_deposits FORCE ROW LEVEL SECURITY;
CREATE POLICY security_deposits_tenant_isolation ON commerce.security_deposits
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
