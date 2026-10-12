-- Primer uso real del schema rental (Vehicle/Reservation/Invoice siguen vacios) - USAGE
-- nunca se otorgo antes, a diferencia de organization/support/identity.
GRANT USAGE ON SCHEMA rental TO app_runtime;

-- RLS estandar (docs/persistence/06-RLS.md) para las 3 tablas - ninguna esta en la lista de
-- casos especiales (companies con auto-comparacion de id; roles/audit_log/outbox_event con
-- company_id nulable). Grant completo, no restringido como audit_log - el bloqueo/
-- desbloqueo y la verificacion de documentos son UPDATE reales.
GRANT SELECT, INSERT, UPDATE, DELETE ON rental.customers TO app_runtime;
ALTER TABLE rental.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.customers FORCE ROW LEVEL SECURITY;
CREATE POLICY customers_tenant_isolation ON rental.customers
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.identity_documents TO app_runtime;
ALTER TABLE rental.identity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.identity_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_documents_tenant_isolation ON rental.identity_documents
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.additional_drivers TO app_runtime;
ALTER TABLE rental.additional_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.additional_drivers FORCE ROW LEVEL SECURITY;
CREATE POLICY additional_drivers_tenant_isolation ON rental.additional_drivers
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
