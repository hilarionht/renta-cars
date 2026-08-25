-- Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109). RLS estandar, sin
-- excepcion de bypass por hash (a diferencia de rental.customer_sessions) - el
-- request/verify de OTP siempre trae companyId explicito en el body, mismo patron que
-- LoginHandler.findByCompanyAndEmail().
GRANT SELECT, INSERT, UPDATE, DELETE ON rental.customer_otp_challenges TO app_runtime;
ALTER TABLE rental.customer_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.customer_otp_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_otp_challenges_tenant_isolation ON rental.customer_otp_challenges
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
