-- RLS estandar de support.notifications (docs/persistence/06-RLS.md) - mismo patron completo
-- que support.files (no append-only, hay UPDATE real en send()/markDelivered()/fail()/
-- markFailed()). USAGE ON SCHEMA support ya otorgado en 20260816210600_support_audit_log_rls.
GRANT SELECT, INSERT, UPDATE, DELETE ON support.notifications TO app_runtime;

ALTER TABLE support.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support.notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_tenant_isolation ON support.notifications
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
