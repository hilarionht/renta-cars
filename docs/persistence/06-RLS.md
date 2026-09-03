# 06 — Row-Level Security

Este documento diseña completamente la estrategia de Row-Level Security (RLS) sobre el inventario de tablas de [02-TABLAS.md](02-TABLAS.md). No reabre la decisión raíz — RLS como segunda capa de defensa de aislamiento multi-tenant, obligatoria y no sustituible por el filtro de aplicación — ya fijada en [ADR-0004](../ADR/0004-multitenancy.md) y en el mecanismo concreto (`Prisma Client Extension` + `SET LOCAL` transaccional) ya fijado en [technical/04-PERSISTENCE.md §5](../technical/04-PERSISTENCE.md). Este documento fija la política exacta por tabla, incluidos los tres casos especiales que el modelo físico introduce (`companies`, `roles` con alcance `System`, y el mecanismo transversal de `outbox_event`/`audit_log`).

## 1. Mecanismo base (heredado, no redefinido)

1. Toda conexión de la aplicación ejecuta `SET LOCAL app.current_company_id = <valor>` como primera sentencia de cada transacción, antes de cualquier consulta ([technical/04-PERSISTENCE.md §5](../technical/04-PERSISTENCE.md)).
2. `SET LOCAL` (nunca `SET SESSION`) porque su alcance está limitado a la transacción activa — obligatorio bajo _connection pooling_ en modo _transaction_ (PgBouncer o equivalente), donde una conexión física se reutiliza entre transacciones de tenants distintos; `SET SESSION` fugaría el valor al siguiente tenant que reutilice la misma conexión.
3. Toda tabla con `company_id` (§2 de [04-COLUMNAS-CONCEPTUALES.md](04-COLUMNAS-CONCEPTUALES.md) — es decir, todas salvo `companies`) tiene RLS habilitado con una política `USING (company_id = current_setting('app.current_company_id', true)::uuid)`.
4. El uso de `current_setting(..., true)` (con el segundo argumento `true`, "missing_ok") en vez de `current_setting(...)` sin ese argumento es deliberado: si por un bug la variable de sesión no se fijó, la función retorna `NULL` en vez de lanzar una excepción de PostgreSQL — y `company_id = NULL` es siempre falso, por lo que la política deniega todo acceso por defecto (fail-closed) en vez de fallar con un error genérico de "unrecognized configuration parameter" que un desarrollador podría interpretar erróneamente como un problema no relacionado con seguridad. Es la misma filosofía de "fallar cerrado, nunca abierto" que ya rige el resto de la arquitectura de seguridad ([09-SEGURIDAD.md §5](../09-SEGURIDAD.md)).

## 2. Por qué toda tabla lleva su propio `company_id` en vez de resolverlo por `JOIN`

Ya justificado en [04-COLUMNAS-CONCEPTUALES.md §2](04-COLUMNAS-CONCEPTUALES.md): una política RLS se evalúa por tabla, y una política que dependiera de un subquery hacia la tabla padre (p. ej. `rates` resolviendo el tenant a través de `vehicle_categories`) sería estructuralmente más frágil — cualquier `JOIN` faltante en una política mal escrita rompería el aislamiento silenciosamente — y más costosa en el plan de ejecución. La denormalización de `company_id` en cada una de las 31 tablas de [02-TABLAS.md](02-TABLAS.md) es lo que permite que **cada política RLS de este documento sea una única comparación de igualdad, sin excepción, salvo los tres casos especiales de §4**.

## 3. Rol de aplicación vs. rol propietario de tabla — el requisito que hace RLS efectivo

PostgreSQL exime por defecto al **propietario de la tabla** de sus propias políticas RLS. Esto significa que si la aplicación se conectara con el mismo rol que creó las tablas (el rol que ejecuta las migraciones), RLS **no tendría ningún efecto** — toda la defensa en profundidad de [ADR-0004](../ADR/0004-multitenancy.md) quedaría reducida a la única capa del filtro de aplicación, exactamente el escenario de fallo único que esa decisión existe para evitar. Este es un requisito de diseño físico que ningún documento anterior fijó explícitamente porque pertenece al nivel de detalle de esta fase:

- **Rol `migrator`**: propietario de todas las tablas de todos los schemas; el único que ejecuta Prisma Migrate; nunca usado por `apps/api` en tiempo de ejecución.
- **Rol `app_runtime`**: el que usa el `PrismaClient` de la aplicación en todo entorno; **no** es propietario de ninguna tabla; tiene privilegios `SELECT`/`INSERT`/`UPDATE`/`DELETE` otorgados explícitamente por tabla (y explícitamente **sin** `UPDATE`/`DELETE` sobre `support.audit_log`, §5); está sujeto a todas las políticas RLS de este documento.
- Se aplica `FORCE ROW LEVEL SECURITY` (no solo `ENABLE ROW LEVEL SECURITY`) en toda tabla como segunda salvaguarda — así, aunque una futura migración cambiara accidentalmente el propietario de una tabla al rol `app_runtime`, la política seguiría aplicándose incluso a su propietario.

Esta separación de roles es, junto con `SET LOCAL` (§1) y la denormalización de `company_id` (§2), el tercer pilar mecánico sin el cual "RLS habilitado" sería una ilusión de seguridad. Se documenta como decisión nueva en [10-DECISIONES.md](10-DECISIONES.md) #10.

## 4. Casos especiales

### 4.1 `companies` — no tiene `company_id`, tiene política sobre su propio `id`

`companies` es la raíz de tenant; su propia clave primaria **es** el valor que toda otra tabla porta como `company_id`. Su política RLS no compara `company_id` sino directamente `id`:

```
USING (id = current_setting('app.current_company_id', true)::uuid)
```

Esto significa que, bajo el contexto normal de un usuario autenticado de una `Company`, una consulta a `companies` solo puede ver la fila de su propia empresa — nunca el listado de todas las companies de la Plataforma, lo cual es correcto por diseño (ningún actor de negocio de una `Company` tiene razón para enumerar otras).

### 4.2 `roles` con `company_id` nulable — el único caso de tenant "compartido"

Los roles de alcance `System` son un catálogo global de Plataforma, visible por diseño a **toda** `Company` ([model/02-AGGREGATES.md §2](../model/02-AGGREGATES.md)). Su política no puede ser una simple igualdad — debe admitir explícitamente las filas globales:

```
USING (
  company_id = current_setting('app.current_company_id', true)::uuid
  OR company_id IS NULL
)
```

**Por qué esto no es una brecha de aislamiento**: la cláusula `OR company_id IS NULL` únicamente expone filas que, por invariante de agregado (INV-026, [model/02-AGGREGATES.md §2](../model/02-AGGREGATES.md)), son de solo lectura para toda `Company` y no contienen ningún dato propio de un tenant — son, precisamente, el catálogo de roles base de Plataforma. Ninguna otra tabla de este modelo tiene esta forma de política; es una excepción puntual y documentada, no un patrón a replicar sin la misma justificación de "catálogo verdaderamente global y de solo lectura para todos".

### 4.3 `audit_log` y `outbox_event` con `company_id` nulable — mismo patrón, propósito distinto

A diferencia de `roles`, aquí la nulidad de `company_id` no habilita visibilidad cruzada de un catálogo compartido — refleja que el propio evento que originó la fila era verdaderamente global (`CompanyRegistered.v1`, donde el sujeto es la creación misma de la `Company` y por tanto no hay un tenant preexistente al que anclar la fila). La política es idéntica en forma a la de `roles` (`company_id = ... OR company_id IS NULL`), pero su efecto práctico es distinto: expone a **todo** tenant las filas de eventos verdaderamente globales de Plataforma, que por definición no contienen datos de negocio de ningún tenant específico — coherente con que esos eventos, por diseño de [model/06-DOMAIN_EVENTS.md §1](../model/06-DOMAIN_EVENTS.md), nunca llevan un payload de datos de un tenant ajeno.

### 4.4 `audit_log` — append-only reforzado con permisos, no solo con RLS

RLS controla **qué filas** son visibles/escribibles; no impide por sí sola una operación `UPDATE`/`DELETE` sobre una fila que la política ya permite ver. INV-024 (append-only estricto) se protege con una capa adicional y distinta de RLS: el rol `app_runtime` **no tiene privilegio `UPDATE` ni `DELETE`** otorgado sobre `support.audit_log` en absoluto — un `REVOKE` explícito a nivel de motor, no una política. Esta es la segunda capa de defensa que [model/07-INVARIANTS.md §6](../model/07-INVARIANTS.md) ya documenta para INV-024; este documento fija que el mecanismo concreto es `GRANT`/`REVOKE` de PostgreSQL, no una política RLS adicional (RLS y permisos de `GRANT` son ortogonales: RLS filtra filas, `GRANT` filtra operaciones — ambos son necesarios, ninguno sustituye al otro).

## 5. Bypass administrativo (operaciones genuinamente cross-tenant)

Un número reducido y explícitamente documentado de operaciones de negocio son legítimamente cross-tenant — no una fuga, sino una capacidad de plataforma ya prevista:

| Operación                                                                                                                              | Por qué es cross-tenant                                                                                                                                                                                                   | Mecanismo                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suspensión de `Company` por impago de suscripción SaaS                                                                                 | El actor es un rol de super-administración de Plataforma, no un usuario de ninguna `Company` — ya fijado en [model/02-AGGREGATES.md §4](../model/02-AGGREGATES.md) y [08-API-CONTRACTS.md §2](../08-API-CONTRACTS.md)     | Rol de base de datos separado, `platform_admin`, con el atributo `BYPASSRLS`                                                                                                                                                                                            |
| Migraciones y seeds                                                                                                                    | Deben poder escribir en cualquier `company_id`, incluidos los roles `System` globales                                                                                                                                     | El rol `migrator` (§3) ya es propietario de las tablas, por lo que RLS no le aplica sin necesidad de `BYPASSRLS` adicional — pero nunca es el rol de conexión de `apps/api`                                                                                             |
| Soporte técnico/operaciones internas de incidentes (fuera de v1.0, anticipado)                                                         | Un ingeniero de guardia investigando un incidente cross-tenant                                                                                                                                                            | Mismo rol `platform_admin`, invocado únicamente desde una herramienta administrativa separada de `apps/api`, nunca desde el pool de conexión de la aplicación de negocio ordinaria                                                                                      |
| Reminder de reservas: enumerar `company_id` activas para el scan periódico de recordatorios (`docs/persistence/10-DECISIONES.md #121`) | Un job en background (`ReservationReminderScanProcessor`, BullMQ) no tiene ningún `RequestContext` de tenant — necesita saber a qué companies iterar antes de poder abrir una transacción `SET LOCAL` normal por cada una | Mismo rol `platform_admin`, invocado únicamente desde `PlatformAdminPrismaService` (un segundo `PrismaClient`, nunca el pool de `apps/api`), `GRANT` acotado a `SELECT` sobre `organization.companies` únicamente — ninguna otra tabla, aunque el rol tenga `BYPASSRLS` |

**Regla no negociable de este bypass**: `platform_admin` (`BYPASSRLS`) nunca es el rol que usa el `PrismaClient` de `apps/api` en el camino de negocio ordinario — es un rol de un segundo `PrismaClient`/conexión, usado exclusivamente por el puñado de casos de uso ya identificados como cross-tenant en [08-API-CONTRACTS.md §2](../08-API-CONTRACTS.md), cada uno con su propio Guard de autorización de plataforma (no un permiso de `Company`) y registrado con máxima prioridad en `AuditLogEntry` ([09-SEGURIDAD.md §5](../09-SEGURIDAD.md): "todo test de seguridad de Fase 6 prioriza escenarios de fuga cross-tenant"). Introducir `BYPASSRLS` en cualquier otro rol, o ampliar su uso a un caso de uso no listado en esta tabla, es exactamente el tipo de cambio que exige revisar primero [ADR-0004](../ADR/0004-multitenancy.md), no una decisión de implementación local.

## 6. Query Handlers de solo lectura (CQRS) — por qué también necesitan `SET LOCAL`

[technical/04-PERSISTENCE.md §3](../technical/04-PERSISTENCE.md) fija que un Query Handler de solo lectura usa el `PrismaClient` de scope de aplicación "sin necesidad de UoW" (Unit of Work, el mecanismo que coordina escritura + outbox). Esto podría leerse, incorrectamente, como que un Query Handler no necesita una transacción — pero `SET LOCAL` solo tiene efecto **dentro** de una transacción activa; sin ella, la variable de sesión nunca se fija y la política RLS del §1 deniega todo por defecto (fail-closed, coherente con §1.4), incluso para una simple lectura legítima.

**Resolución**: todo Query Handler ejecuta su(s) consulta(s) dentro de una transacción de solo lectura ligera (`prisma.$transaction([...], { isolation: ReadCommitted })` o equivalente) cuyo único propósito es dar alcance a `SET LOCAL app.current_company_id` — una transacción de lectura, no el `UnitOfWork` de escritura+outbox de [technical/04-PERSISTENCE.md §3](../technical/04-PERSISTENCE.md), que son dos mecanismos distintos aunque ambos se apoyen en `prisma.$transaction`. Esto no contradice la separación Command/Query ya fijada en [ADR-0007](../ADR/0007-cqrs-selectivo.md) — la separación es sobre _modelo_ (rico vs. proyección optimizada) y _responsabilidad_ (mutación vs. lectura), no sobre si una conexión de base de datos usa o no una transacción; toda conexión a estas tablas, lea o escriba, necesita saber a qué tenant pertenece. Esta aclaración se documenta como decisión nueva en [10-DECISIONES.md](10-DECISIONES.md) #11 porque ningún documento anterior la hacía explícita.

## 7. Qué NO se decide en este documento

- Los valores concretos de configuración de PgBouncer/pooler → [technical/04-PERSISTENCE.md §9](../technical/04-PERSISTENCE.md) (sin cambios, calibración en Fase 6).
- El nombre exacto de cada rol de PostgreSQL en cada entorno (dev/staging/producción) → [technical/08-DEVOPS.md](../technical/08-DEVOPS.md), fuera de alcance de este documento de modelado.
- Tests automatizados de fuga cross-tenant → ya fijados como obligatorios en [10-TESTING.md §7](../10-TESTING.md); este documento fija la política que esos tests deben verificar, no la suite en sí.
