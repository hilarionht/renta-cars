-- RLS estandar de support.files (docs/persistence/06-RLS.md) - a diferencia de
-- support.audit_log (append-only, INV-024, GRANT restringido a SELECT/INSERT), el "delete"
-- de File es una actualizacion logica real (UPDATE upload_status), asi que aca el GRANT es
-- completo, mismo patron que organization.companies/branches.
-- USAGE ON SCHEMA support ya otorgado en 20260814114037_identity_rls /
-- 20260816210600_support_audit_log_rls.
GRANT SELECT, INSERT, UPDATE, DELETE ON support.files TO app_runtime;

ALTER TABLE support.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE support.files FORCE ROW LEVEL SECURITY;
CREATE POLICY files_tenant_isolation ON support.files
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
