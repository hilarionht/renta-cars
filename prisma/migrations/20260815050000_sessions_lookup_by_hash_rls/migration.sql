-- Login/RefreshSession/RevokeSession corren en rutas @Public() (no hay JWT todavia) y
-- necesitan encontrar una Session por su refresh_token_hash ANTES de saber a que company
-- pertenece - la politica de tenant-scoping existente (company_id = tenant actual) no puede
-- satisfacerse en ese momento. refresh_token_hash es un secreto de 256 bits, unico
-- globalmente (sessions_refresh_token_hash_key) - conocer el valor en texto plano ES la
-- autorizacion, no el tenant. Se agrega una segunda clausula, acotada a un GUC nombrado que
-- SOLO PrismaSessionRepository.findByRefreshTokenHash fija, en su propia transaccion minima,
-- nunca junto con una escritura. Decision registrada en docs/persistence/10-DECISIONES.md.
DROP POLICY IF EXISTS sessions_tenant_isolation ON identity.sessions;
CREATE POLICY sessions_tenant_isolation ON identity.sessions
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR current_setting('app.session_lookup_by_hash', true) = 'true'
  );
