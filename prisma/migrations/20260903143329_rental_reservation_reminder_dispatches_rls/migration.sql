-- USAGE en schema rental ya otorgado (migracion de Customers, 20260817190600), no se repite
-- aca. RLS estandar (docs/persistence/06-RLS.md) - reservation_reminder_dispatches no esta
-- en la lista de casos especiales, misma politica que cualquier otra tabla con company_id.
GRANT SELECT, INSERT, UPDATE, DELETE ON rental.reservation_reminder_dispatches TO app_runtime;
ALTER TABLE rental.reservation_reminder_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.reservation_reminder_dispatches FORCE ROW LEVEL SECURITY;
CREATE POLICY reservation_reminder_dispatches_tenant_isolation ON rental.reservation_reminder_dispatches
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
