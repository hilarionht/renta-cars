-- USAGE en schema rental ya otorgado por la migracion de Customers (20260817190600), no
-- se repite aca.

-- RLS estandar (docs/persistence/06-RLS.md) para las 5 tablas de Vehicles - ninguna esta en
-- la lista de casos especiales. Grant completo, no restringido como audit_log.
GRANT SELECT, INSERT, UPDATE, DELETE ON rental.vehicle_categories TO app_runtime;
ALTER TABLE rental.vehicle_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.vehicle_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY vehicle_categories_tenant_isolation ON rental.vehicle_categories
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.rates TO app_runtime;
ALTER TABLE rental.rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.rates FORCE ROW LEVEL SECURITY;
CREATE POLICY rates_tenant_isolation ON rental.rates
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.vehicles TO app_runtime;
ALTER TABLE rental.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.vehicles FORCE ROW LEVEL SECURITY;
CREATE POLICY vehicles_tenant_isolation ON rental.vehicles
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.vehicle_documents TO app_runtime;
ALTER TABLE rental.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.vehicle_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY vehicle_documents_tenant_isolation ON rental.vehicle_documents
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.maintenance_records TO app_runtime;
ALTER TABLE rental.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.maintenance_records FORCE ROW LEVEL SECURITY;
CREATE POLICY maintenance_records_tenant_isolation ON rental.maintenance_records
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
