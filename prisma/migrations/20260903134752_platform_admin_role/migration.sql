-- docs/persistence/06-RLS.md §5 / docs/persistence/10-DECISIONES.md #121: rol Postgres ya
-- anticipado pero nunca materializado (ninguno de los 3 casos cross-tenant que el propio
-- doc lista estaba construido todavia). Reminder de reservas es el primer consumidor real.
--
-- BYPASSRLS a nivel de rol, pero GRANT acotado a una sola columna de una sola tabla - RLS y
-- GRANT son ortogonales (06-RLS.md SS5.4): aunque el rol tenga BYPASSRLS, sin GRANT sobre
-- cualquier otra tabla (rental.reservations incluida) es fisicamente incapaz de leerla, sin
-- importar el atributo. Nunca es el rol de conexion de apps/api en el camino ordinario -
-- solo PlatformAdminPrismaService (un segundo PrismaClient) lo usa.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'platform_admin') THEN
    CREATE ROLE platform_admin LOGIN PASSWORD 'platform_admin' BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA organization TO platform_admin;
GRANT SELECT ON organization.companies TO platform_admin;
