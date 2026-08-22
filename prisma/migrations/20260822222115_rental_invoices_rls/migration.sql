-- USAGE en schema rental ya otorgado por la migracion de Customers (20260817190600), no se
-- repite aca. RLS estandar (docs/persistence/06-RLS.md) para las 3 tablas nuevas de
-- Invoices - ninguna esta en la lista de casos especiales. Grant completo, no restringido
-- como audit_log.
GRANT SELECT, INSERT, UPDATE, DELETE ON rental.invoices TO app_runtime;
ALTER TABLE rental.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoices_tenant_isolation ON rental.invoices
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.charges TO app_runtime;
ALTER TABLE rental.charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.charges FORCE ROW LEVEL SECURITY;
CREATE POLICY charges_tenant_isolation ON rental.charges
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- company_id es la propia PK de esta tabla (no hay una columna separada) - la politica
-- compara directo contra la PK, mismo mecanismo, ninguna diferencia de tratamiento.
GRANT SELECT, INSERT, UPDATE, DELETE ON rental.invoice_number_sequences TO app_runtime;
ALTER TABLE rental.invoice_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.invoice_number_sequences FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_number_sequences_tenant_isolation ON rental.invoice_number_sequences
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
