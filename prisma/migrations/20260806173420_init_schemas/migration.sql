-- Migracion editada a mano (mismo procedimiento que docs/persistence/07-MIGRACIONES.md §3
-- para lo que el DSL declarativo de Prisma no cubre): declarar `schemas` en el datasource
-- (prisma/schema/base.prisma) no genera por si solo las sentencias `CREATE SCHEMA` cuando
-- todavia no existe ningun modelo que use `@@schema(...)` - Prisma Migrate solo emite SQL
-- para diferencias que puede diffear contra el schema declarativo, y un namespace sin
-- modelos no produce diff. Paso 6 de docs/engineering/10-BOOTSTRAP-PLAN.md pide
-- explicitamente que esta primera migracion cree los seis schemas sin tablas, listos para
-- que Fase 0 de docs/01-ROADMAP.md agregue los primeros modelos.

CREATE SCHEMA IF NOT EXISTS "identity";

CREATE SCHEMA IF NOT EXISTS "organization";

CREATE SCHEMA IF NOT EXISTS "scheduling";

CREATE SCHEMA IF NOT EXISTS "rental";

CREATE SCHEMA IF NOT EXISTS "commerce";

CREATE SCHEMA IF NOT EXISTS "support";
