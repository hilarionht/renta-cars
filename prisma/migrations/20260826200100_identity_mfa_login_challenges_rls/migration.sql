-- MFA TOTP (docs/persistence/10-DECISIONES.md #111). RLS estandar, sin excepcion de bypass
-- por hash (a diferencia de identity.sessions) - POST /auth/mfa/verify siempre trae
-- companyId explicito en el body, mismo patron que rental.customer_otp_challenges.
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.mfa_login_challenges TO app_runtime;
ALTER TABLE identity.mfa_login_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.mfa_login_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY mfa_login_challenges_tenant_isolation ON identity.mfa_login_challenges
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
