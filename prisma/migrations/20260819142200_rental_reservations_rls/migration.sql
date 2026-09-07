-- USAGE en schema rental ya otorgado por la migracion de Customers (20260817190600), no
-- se repite aca.

-- RLS estandar (docs/persistence/06-RLS.md) para las 7 tablas de Reservations - ninguna
-- esta en la lista de casos especiales. Grant completo, no restringido como audit_log.
GRANT SELECT, INSERT, UPDATE, DELETE ON rental.reservations TO app_runtime;
ALTER TABLE rental.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY reservations_tenant_isolation ON rental.reservations
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.inspections TO app_runtime;
ALTER TABLE rental.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.inspections FORCE ROW LEVEL SECURITY;
CREATE POLICY inspections_tenant_isolation ON rental.inspections
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.inspection_photos TO app_runtime;
ALTER TABLE rental.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.inspection_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY inspection_photos_tenant_isolation ON rental.inspection_photos
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.damage_reports TO app_runtime;
ALTER TABLE rental.damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.damage_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY damage_reports_tenant_isolation ON rental.damage_reports
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.damage_report_photos TO app_runtime;
ALTER TABLE rental.damage_report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.damage_report_photos FORCE ROW LEVEL SECURITY;
CREATE POLICY damage_report_photos_tenant_isolation ON rental.damage_report_photos
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.price_adjustments TO app_runtime;
ALTER TABLE rental.price_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.price_adjustments FORCE ROW LEVEL SECURITY;
CREATE POLICY price_adjustments_tenant_isolation ON rental.price_adjustments
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON rental.reservation_authorized_drivers TO app_runtime;
ALTER TABLE rental.reservation_authorized_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental.reservation_authorized_drivers FORCE ROW LEVEL SECURITY;
CREATE POLICY reservation_authorized_drivers_tenant_isolation ON rental.reservation_authorized_drivers
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);
