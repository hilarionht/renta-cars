-- Row-Level Security (docs/persistence/06-RLS.md, ADR-0004) - defensa en profundidad,
-- segunda capa ademas del filtro de aplicacion (tenant-scope.extension.ts).
--
-- Separacion de roles (docs/persistence/06-RLS.md §3, decision #10 de
-- docs/persistence/10-DECISIONES.md): Postgres exime al OWNER de una tabla de sus propias
-- politicas RLS por defecto. El rol de bootstrap (`renta`, POSTGRES_USER de
-- docker-compose.yml, superusuario en este contenedor) ya cumple el rol de "migrator" de
-- los docs - dueño de todo, usado solo para migrar, nunca para runtime de la app. No se
-- crea un rol `migrator` separado: seria una capa de indireccion sin beneficio real sobre
-- lo que `renta` ya es en este entorno. Lo que SI se crea es `app_runtime`: el rol nuevo
-- que la app usa en runtime (ver APP_DATABASE_URL en .env), sin privilegios de owner,
-- sujeto a RLS de verdad.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'app_runtime';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA identity TO app_runtime;
GRANT USAGE ON SCHEMA support TO app_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON identity.users, identity.roles, identity.user_roles, identity.sessions TO app_runtime;
-- Sin UPDATE/DELETE en outbox_event - el relay worker que los necesitaria (marcar
-- published_at) queda fuera de esta tanda (docs/persistence/10-DECISIONES.md).
GRANT SELECT, INSERT ON support.outbox_event TO app_runtime;

ALTER TABLE identity.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON identity.users
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

ALTER TABLE identity.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_tenant_isolation ON identity.sessions
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

ALTER TABLE identity.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.user_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY user_roles_tenant_isolation ON identity.user_roles
  USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid);

-- Caso especial (docs/persistence/06-RLS.md §4.2): company_id nullable = System role,
-- catalogo global visible desde cualquier tenant.
ALTER TABLE identity.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.roles FORCE ROW LEVEL SECURITY;
CREATE POLICY roles_tenant_isolation ON identity.roles
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR company_id IS NULL
  );

-- outbox_event tambien tiene company_id nullable (eventos de alcance no-tenant son
-- infrecuentes hoy pero el campo lo permite, docs/persistence/06-RLS.md §4.3) - misma
-- politica que roles.
ALTER TABLE support.outbox_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE support.outbox_event FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_event_tenant_isolation ON support.outbox_event
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR company_id IS NULL
  );
