-- Primer uso real del schema scheduling - USAGE nunca se otorgo antes.
GRANT USAGE ON SCHEMA scheduling TO app_runtime;

-- RLS estandar (docs/persistence/06-RLS.md) - grant completo, no restringido como
-- audit_log. company_id es infraestructura pura (docs/persistence/01-SCHEMAS.md SS4.3),
-- pero la politica de RLS es identica a la de toda otra tabla del modelo.
GRANT SELECT, INSERT, UPDATE, DELETE ON scheduling.availability_slots TO app_runtime;
ALTER TABLE scheduling.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling.availability_slots FORCE ROW LEVEL SECURITY;
CREATE POLICY availability_slots_tenant_isolation ON scheduling.availability_slots
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
