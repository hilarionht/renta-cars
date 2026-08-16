-- INV-024 (docs/model/07-INVARIANTS.md SS1, SS6): AuditLogEntry es append-only, sin
-- UPDATE/DELETE desde la aplicacion, sin excepcion. Segunda capa de defensa via permisos
-- (docs/persistence/06-RLS.md SS4.4) - app_runtime NUNCA recibe UPDATE ni DELETE sobre esta
-- tabla, un REVOKE explicito a nivel de motor, no una politica RLS (RLS filtra filas, GRANT
-- filtra operaciones - ninguno sustituye al otro). Mismo patron ya usado en outbox_event.
-- USAGE ON SCHEMA support ya otorgado en 20260814114037_identity_rls.
GRANT SELECT, INSERT ON support.audit_log TO app_runtime;

-- company_id nulable, mismo patron que outbox_event/roles (docs/persistence/06-RLS.md SS4.3)
-- - solo para eventos verdaderamente globales de Plataforma, ninguno real todavia lo ejerce.
ALTER TABLE support.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE support.audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_log_tenant_isolation ON support.audit_log
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR company_id IS NULL
  );
