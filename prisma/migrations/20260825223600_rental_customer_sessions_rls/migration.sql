-- Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109). A diferencia de
-- identity.sessions (donde el bypass de lookup-por-hash se agrego en una migracion RLS
-- separada, retrofit sobre una policy ya existente - ver 20260815050000_sessions_lookup_by_
-- hash_rls), rental.customer_sessions es una tabla nueva: el bypass va directo en la unica
-- migracion RLS, en un solo paso.
--
-- GUC propia y distinta de la de identity (app.customer_session_lookup_by_hash, nunca
-- app.session_lookup_by_hash) - son 2 fronteras de seguridad aisladas a proposito, mismo
-- criterio que "CustomerSession paralela a Session, no compartida" del resto del modulo.
-- refresh_token_hash es un secreto de 256 bits, unico globalmente
-- (customer_sessions_refresh_token_hash_key) - conocer el valor en texto plano ES la
-- autorizacion, no el tenant. El GUC solo lo fija PrismaCustomerSessionRepository.
-- findByRefreshTokenHash(), en su propia transaccion minima, nunca junto con una escritura.
GRANT SELECT, INSERT, UPDATE, DELETE ON rental.customer_sessions TO app_runtime;
ALTER TABLE rental.customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.customer_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_sessions_tenant_isolation ON rental.customer_sessions
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR current_setting('app.customer_session_lookup_by_hash', true) = 'true'
  );
