# 07 — Migraciones

Este documento define la estrategia completa de migraciones sobre el modelo físico ya fijado en [01-SCHEMAS.md](01-SCHEMAS.md) a [06-RLS.md](06-RLS.md). No redefine el mecanismo raíz — Prisma Migrate como único mecanismo de evolución de esquema, prohibido alterar manualmente en producción — ya fijado en [04-MODELO-DATOS.md §6](../04-MODELO-DATOS.md) y desarrollado en [technical/04-PERSISTENCE.md §7](../technical/04-PERSISTENCE.md). Este documento fija versionado, rollback, datos iniciales, seeds y compatibilidad al nivel de detalle que faltaba en esas dos fuentes.

## 1. Versionado

- **Historial único** para todo el datasource, aunque el schema Prisma sea multi-archivo (uno por Bounded Context, [01-SCHEMAS.md §1](01-SCHEMAS.md)) — limitación de la herramienta ya señalada en [technical/04-PERSISTENCE.md §7](../technical/04-PERSISTENCE.md), no una decisión de este documento.
- **Convención de nombre**: `<timestamp>_<schema>_<descripción>` (p. ej. `20260115_identity_add_mfa_secret`), donde `<schema>` es siempre uno de los seis nombres fijados en [01-SCHEMAS.md §1](01-SCHEMAS.md) — permite identificar el dueño de una migración sin abrir el archivo, y hace mecánicamente verificable en CI que ninguna migración de un desarrollador de `rental` modifica tablas de `identity`/`organization`/`scheduling`/`commerce`/`support` sin la revisión del equipo dueño (`CODEOWNERS`, [technical/08-DEVOPS.md](../technical/08-DEVOPS.md)).
- **Una migración, un schema**: una migración que necesite tocar dos schemas (caso raro — debería ser excepcional dado que no hay FK cross-schema, [03-RELACIONES.md §1](03-RELACIONES.md)) se divide en dos migraciones separadas, cada una revisada por el equipo dueño correspondiente, nunca una migración conjunta con doble ownership ambiguo.
- **Orden de creación inicial**: la primera migración de cada schema respeta el orden de dependencia de FK intra-schema ya fijado en [03-RELACIONES.md §2](03-RELACIONES.md) — p. ej., dentro de `rental`, `vehicle_categories` y `customers` se crean antes que `vehicles` y `reservations`, que a su vez se crean antes que `invoices`. Prisma Migrate resuelve este orden automáticamente a partir del grafo de relaciones declaradas; se documenta aquí solo para que un desarrollador entienda por qué el historial generado tiene ese orden y no lo reordene manualmente.

## 2. Expand/Contract como único patrón de migración con cero downtime

Ya fijado como principio general en [04-MODELO-DATOS.md §6](../04-MODELO-DATOS.md) ("toda migración es aditiva y reversible cuando sea posible") y detallado en [technical/04-PERSISTENCE.md §7](../technical/04-PERSISTENCE.md). Este documento fija la secuencia exacta de pasos, porque es el patrón que un desarrollador ejecutará decenas de veces a lo largo de los 10 años de vida del proyecto:

| Paso | Migración | Reversible sin pérdida de datos |
|---|---|---|
| 1. Expand | Agregar columna nueva como nulable (o con `DEFAULT`) | Sí — un rollback simplemente elimina una columna sin datos consumidos aún por el código desplegado |
| 2. Backfill | Job de aplicación (no una migración de Prisma) que puebla la columna nueva en filas existentes | Sí, idempotente por diseño — puede re-ejecutarse sin duplicar efecto |
| 3. Contract | Migración separada que agrega la restricción `NOT NULL`/`CHECK`/FK definitiva | Reversible solo si ningún dato ya escrito viola la restricción nueva — se verifica antes de aplicar, nunca se fuerza |
| 4. (Eliminar una columna/tabla obsoleta) | Migración final, solo después de confirmar en producción que ningún código desplegado la lee (mínimo un ciclo de despliegue completo sin lectores) | Es, por definición, el único paso de este patrón que no es reversible sin restaurar de backup — por eso es siempre el último paso, nunca el primero |

**Aplicación concreta a este modelo**: cualquier columna nueva de `04-COLUMNAS-CONCEPTUALES.md` que se agregue después del lanzamiento de v1.0 (p. ej. un campo de política nuevo en `company_settings`) sigue esta secuencia de cuatro pasos sin excepción — ni siquiera para columnas aparentemente inofensivas, porque el objetivo es que un despliegue nunca requiera una ventana de mantenimiento, coherente con el horizonte de 10 años que toda la arquitectura ya asume ([00-VISION.md](../00-VISION.md)).

## 3. Exclusion constraints — el único DDL que Prisma no genera

Ya señalado en [technical/04-PERSISTENCE.md §7](../technical/04-PERSISTENCE.md): el DSL de Prisma no tiene sintaxis nativa para `EXCLUDE USING gist`, necesario para `availability_slots` y `rates` ([05-INDICES-Y-CONSTRAINTS.md §5](05-INDICES-Y-CONSTRAINTS.md)). Procedimiento fijado por este documento:

1. Ejecutar `prisma migrate dev --create-only` para generar el SQL de la migración a partir del `schema.prisma` (que ya declara las columnas y el índice compuesto normal, pero no el exclusion constraint).
2. Editar manualmente el archivo SQL generado, agregando la sentencia `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE USING gist (...)`.
3. El cuerpo de la migración debe llevar, como comentario SQL, qué invariante de [model/07-INVARIANTS.md](../model/07-INVARIANTS.md) protege (p. ej. `-- INV-013/INV-102: no-solapamiento de AvailabilitySlot activo por recurso`) — no como documentación decorativa, sino porque es la única migración de todo el historial cuyo contenido no se puede regenerar automáticamente desde el schema declarativo; un futuro desarrollador que la modifique sin ese contexto podría eliminarla creyendo que es codegen obsoleto.
4. Requiere la extensión `btree_gist` habilitada en la base de datos — la migración que la agrega (`CREATE EXTENSION IF NOT EXISTS btree_gist`) se ejecuta una única vez, en la primera migración de `scheduling` que la necesita, nunca repetida por cada tabla que la usa.

## 4. Rollback

- **Prisma Migrate no genera rollback automático** (a diferencia de otras herramientas con migraciones "down") — cada migración es solo "forward". La estrategia de reversión de este modelo se apoya en el propio patrón Expand/Contract (§2): la mayoría de los pasos son reversibles por construcción (agregar es reversible eliminando lo agregado, mientras ningún dato dependa de ello todavía).
- **Rollback de un paso "Contract" ya aplicado** (agregar `NOT NULL`/FK/exclusion constraint): se ejecuta como una migración *forward* nueva que revierte la restricción — nunca editando ni eliminando el archivo de migración ya aplicado en ningún entorno, coherente con "prohibido alterar el esquema manualmente" ([04-MODELO-DATOS.md §6](../04-MODELO-DATOS.md)) aplicado también al propio historial de migraciones.
- **Rollback de un paso "Eliminar columna/tabla"**: no es mecánico — requiere restaurar desde backup si los datos ya se purgaron físicamente, o (si la eliminación fue reciente y el proveedor de hosting lo soporta) recuperar desde el snapshot de retención de PostgreSQL. Es la razón por la que este paso siempre es el último y más deliberado del patrón (§2).
- **En ningún entorno se usa `prisma migrate reset`** fuera de desarrollo local — ese comando destruye y recrea la base de datos completa, incompatible con cualquier entorno con datos reales.

## 5. Datos iniciales (seeds)

Distinción explícita entre dos categorías de dato inicial, porque cada una tiene un mecanismo y una cadencia distintos:

### 5.1 Catálogo de sistema (versionado junto al código, no junto a los datos de un tenant)

| Dato | Mecanismo | Cuándo se puebla |
|---|---|---|
| Catálogo de `Permission` | Constante TypeScript en cada módulo de dominio ([model/04-VALUE_OBJECTS.md §2](../model/04-VALUE_OBJECTS.md), [technical/07-SECURITY.md §2](../technical/07-SECURITY.md)) — **nunca una fila de base de datos**, no hay seed que lo pueble porque no existe tabla `permissions` ([02-TABLAS.md §7](02-TABLAS.md)) | Se valida al arrancar la aplicación (un registro central verifica que ningún `Role` referencia un permiso inexistente), no se "siembra" |
| Roles `System` (Administrador de Empresa, Operador de Sucursal, Agente de Reservas, Responsable de Mantenimiento, Responsable Comercial/Financiero — actores ya fijados en [domain/01-ACTORES.md §2](../domain/01-ACTORES.md)) | Seed idempotente ejecutado como parte del pipeline de despliegue (no una migración de Prisma — un script de aplicación que hace `upsert` por `role_name` con `scope = 'System'`, `company_id = NULL`) | Una vez por entorno, re-ejecutable sin duplicar filas (idempotente por `role_name` único parcial, [05-INDICES-Y-CONSTRAINTS.md §3](05-INDICES-Y-CONSTRAINTS.md)) |
| Rol de super-administración de Plataforma (bypass cross-tenant, [06-RLS.md §5](06-RLS.md)) | Mismo mecanismo de seed idempotente, con permisos explícitamente distintos del catálogo `System` de negocio — nunca asignable por un Administrador de Empresa | Una vez por entorno |

**Por qué esto no es una migración de Prisma**: una migración de Prisma versiona *estructura*; un seed versiona *datos iniciales de referencia*. Mezclarlos (insertar filas de catálogo dentro del archivo SQL de una migración estructural) acoplaría el ciclo de vida de ambos — una migración estructural que además inserta datos no se puede revertir de forma limpia sin también revertir el dato, y un dato de catálogo que cambia (agregar un permiso nuevo a un rol `System`) no debería requerir una migración de esquema.

### 5.2 Datos por defecto de una `Company` nueva (no un seed global, un efecto de caso de uso)

`CompanySettings` con sus valores por defecto de Plataforma se crea **junto con** cada `Company` nueva ([model/02-AGGREGATES.md §6](../model/02-AGGREGATES.md): "creado junto con `Company`, con valores por defecto de Plataforma") — esto **no** es un seed de migración, es el comportamiento normal del Command Handler de alta de `Company`, que siempre inserta ambas filas (`companies` + `company_settings`) en la misma transacción. Se documenta aquí solo para distinguirlo explícitamente del seed de catálogo de sistema (§5.1): un seed corre una vez por entorno; la creación de `CompanySettings` por defecto corre una vez por cada `Company` que se dé de alta, indefinidamente.

## 6. Compatibilidad

- **Aditivo primero**: toda migración que un consumidor externo (otro módulo, un futuro segundo producto) podría necesitar leer se agrega antes de que cualquier escritor la use — mismo principio que ya rige la compatibilidad de eventos de dominio ([model/06-DOMAIN_EVENTS.md §11](../model/06-DOMAIN_EVENTS.md)), aplicado aquí a columnas en vez de payloads.
- **Ninguna migración elimina una columna que un evento de dominio todavía referencia en su payload** sin antes verificar, contra el catálogo de [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md), que ningún evento vigente depende de ese dato — una columna eliminada demasiado pronto podría dejar un `Listener` de otro módulo sin el dato que su payload prometía.
- **Cambios de tipo de columna** (p. ej. de un enum corto a uno más largo) siguen el mismo patrón Expand/Contract: agregar columna nueva del tipo destino → backfill → migrar lectores/escritores → eliminar columna vieja — nunca un `ALTER COLUMN ... TYPE` directo sobre una tabla con tráfico de producción real, salvo que el cambio sea comprobadamente no bloqueante (p. ej. ensanchar un `varchar` sin límite real).
- **Versionado de eventos vs. versionado de esquema son disciplinas paralelas, no la misma**: un evento nuevo `.v2` (por un cambio de contrato incompatible, [model/06-DOMAIN_EVENTS.md §11](../model/06-DOMAIN_EVENTS.md)) no implica automáticamente una migración de esquema, y viceversa — se coordinan solo cuando el cambio de payload requiere un dato nuevo que antes no se persistía.

## 7. Qué NO se decide en este documento

- El pipeline de CI/CD que ejecuta las migraciones (`prisma migrate deploy`) en cada entorno → [technical/08-DEVOPS.md](../technical/08-DEVOPS.md).
- El mapeo exacto de `CODEOWNERS` por archivo `.prisma` → [technical/08-DEVOPS.md §2](../technical/08-DEVOPS.md) (ya fijado, heredado sin cambios).
- Testing de migraciones con Testcontainers → [10-TESTING.md](../10-TESTING.md), [technical/09-CODING-STANDARDS.md §6](../technical/09-CODING-STANDARDS.md).
