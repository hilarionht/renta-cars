-- RLS estandar de organization.company_settings (docs/persistence/06-RLS.md) - company_id es
-- la propia PK, no un caso especial de auto-comparacion como organization.companies (esa
-- politica compara su propio id; aca company_id es una columna normal, aunque tambien sea
-- la PK). USAGE ON SCHEMA organization ya otorgado en 20260815200100_organization_rls.
GRANT SELECT, INSERT, UPDATE, DELETE ON organization.company_settings TO app_runtime;

ALTER TABLE organization.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.company_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY company_settings_tenant_isolation ON organization.company_settings
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
