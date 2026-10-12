-- RLS para Organization (docs/persistence/06-RLS.md) - mismo rol app_runtime creado en
-- 20260814114037_identity_rls (LOGIN, no propietario, sujeto a RLS).
GRANT USAGE ON SCHEMA organization TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization.companies, organization.branches TO app_runtime;

-- SS4.1: companies no tiene company_id, su propio id ES el valor de tenant. Sin WITH CHECK
-- explicito, Postgres usa el USING como WITH CHECK tambien - el bootstrap de una company
-- nueva funciona porque el aplicativo fija app.current_company_id al id recien generado
-- (EntityId.generate<'Company'>(), en domain/, antes del INSERT) en la misma transaccion -
-- ver docs/persistence/10-DECISIONES.md.
ALTER TABLE organization.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.companies FORCE ROW LEVEL SECURITY;
CREATE POLICY companies_tenant_isolation ON organization.companies
  USING (id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

ALTER TABLE organization.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.branches FORCE ROW LEVEL SECURITY;
CREATE POLICY branches_tenant_isolation ON organization.branches
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
