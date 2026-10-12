-- Recuperacion de contraseña (docs/persistence/10-DECISIONES.md #113). Tabla nueva: el
-- bypass va directo en la unica migracion RLS, en un solo paso (mismo criterio que
-- rental.customer_sessions - a diferencia de identity.sessions, donde el bypass se agrego en
-- una migracion separada, retrofit sobre una policy ya existente).
--
-- GUC propia y distinta de las demas (app.password_reset_lookup_by_hash, nunca
-- app.session_lookup_by_hash ni app.mfa_login_challenge_lookup_by_hash - no existe esa
-- ultima, MfaLoginChallenge se busca por id, no por hash) - token_hash es un secreto de 256
-- bits, unico globalmente (password_reset_challenges_token_hash_key). Conocer el valor en
-- texto plano ES la autorizacion, no el tenant. El GUC solo lo fija
-- PrismaPasswordResetChallengeRepository.findByTokenHash(), en su propia transaccion minima,
-- nunca junto con una escritura.
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.password_reset_challenges TO app_runtime;
ALTER TABLE identity.password_reset_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.password_reset_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY password_reset_challenges_tenant_isolation ON identity.password_reset_challenges
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR current_setting('app.password_reset_lookup_by_hash', true) = 'true'
  );
