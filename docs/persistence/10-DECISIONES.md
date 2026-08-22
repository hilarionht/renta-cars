# 10 — Decisiones

Registro de las decisiones **nuevas** de esta fase de modelado físico — el equivalente, para `docs/persistence/`, de [docs/ADR/](../ADR/README.md) y de [technical/10-DECISIONES.md](../technical/10-DECISIONES.md). Cada entrada aquí es una decisión de **diseño físico** derivada mecánicamente de una regla de dominio o de arquitectura ya fijada, nunca una reinterpretación del negocio. Donde una entrada compara alternativas, es porque el documento correspondiente de esta carpeta remite aquí explícitamente — no se repite la justificación en los dos lugares.

## #1 — `company_id` en `scheduling.availability_slots` pese al diseño deliberadamente "ciego" de Scheduling

**Contexto**: `AvailabilitySlot` está modelado, por diseño de dominio explícito, sin ningún conocimiento de `Company`, `Vehicle` ni ningún concepto de negocio de Rental Operations ([model/01-BOUNDED_CONTEXTS.md §3.3](../model/01-BOUNDED_CONTEXTS.md)). La invariante transversal de plataforma INV-P01 exige, sin embargo, que toda tabla de negocio tenga `company_id` para RLS ([model/07-INVARIANTS.md §3](../model/07-INVARIANTS.md)).

**Alternativas consideradas**:

| Alternativa                                                                                                                                                         | Evaluación                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No incluir `company_id` en `availability_slots`; resolver el aislamiento de tenant vía el `resourceId` (que en la práctica es un `VehicleId` de un tenant conocido) | Descartada: obligaría a una política RLS con subquery hacia `rental.vehicles` — imposible además porque es una FK inter-schema que este mismo modelo prohíbe ([03-RELACIONES.md §1](03-RELACIONES.md)); dejaría a `Scheduling` sin aislamiento de tenant real, la única tabla del modelo en esa situación |
| Incluir `company_id` como columna de infraestructura, nunca leída por `domain/` de `Scheduling`                                                                     | **Elegida**                                                                                                                                                                                                                                                                                               |

**Decisión**: `availability_slots` lleva `company_id NOT NULL`, poblado por la capa de aplicación de `Rental Operations` (quien sí conoce el tenant) al invocar `CalendarPort.occupy(...)`, y usado exclusivamente por la política RLS — nunca expuesto en el contrato de dominio de `AvailabilitySlot` ni en su Value Object `ResourceRef`.

**Por qué no viola la ACL**: la contaminación que [model/01-BOUNDED_CONTEXTS.md §4.2](../model/01-BOUNDED_CONTEXTS.md) prohíbe es de **lenguaje de negocio** (`licensePlate`, `odometer`) — conceptos que un desarrollador de `Scheduling` necesitaría entender para escribir una regla. `company_id` no es lenguaje de negocio de ningún Bounded Context: es infraestructura de seguridad transversal que ya existe, con el mismo significado, en las 31 tablas del modelo. Que también exista aquí no le enseña nada nuevo sobre "qué es un recurso" al dominio de `Scheduling`.

## #2 — Tabla única de `outbox_event` con `source_schema`, no una tabla por schema

**Contexto**: [technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md) deja explícitamente como "decisión de detalle libre para la implementación" si el Outbox es una tabla por schema o una única tabla en `support` con columna `source_schema`.

**Alternativas consideradas**:

| Alternativa                                                          | Ventajas                                                                                                                                                                                                                                         | Por qué se descartó                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una tabla `outbox_event` por schema (6 tablas)                       | Ownership de archivo más simétrico con el resto del modelo (§2 de [01-SCHEMAS.md](01-SCHEMAS.md))                                                                                                                                                | El `OutboxRelayWorker` ([technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md)) tendría que hacer polling sobre 6 tablas en vez de 1 — más consultas periódicas, más índices parciales que mantener, sin beneficio real: el worker es un proceso transversal de plataforma, no un módulo de negocio con ownership de dominio |
| **Una única tabla `outbox_event` en `support`, con `source_schema`** | Un único índice parcial `WHERE published_at IS NULL` que cubre todo el sistema ([05-INDICES-Y-CONSTRAINTS.md §2](05-INDICES-Y-CONSTRAINTS.md)); un único punto de observabilidad operativa ("cuántos eventos pendientes hay en todo el sistema") | — (elegida)                                                                                                                                                                                                                                                                                                                            |

**Decisión**: tabla única `support.outbox_event`, coherente con que el Outbox no pertenece a ningún Bounded Context ([01-SCHEMAS.md §5](01-SCHEMAS.md)) — se aloja en `support` por conveniencia operativa, no por ownership de dominio.

## #3 — Propietario polimórfico de `identity_documents` vía dos FK nulables, no `owner_type`/`owner_id` genérico

**Contexto**: `IdentityDocument` es entidad interna de `Customer` **y** de `AdditionalDriver` ([model/02-AGGREGATES.md §10](../model/02-AGGREGATES.md)), nunca de ambos simultáneamente para la misma fila.

**Alternativas consideradas**:

| Alternativa                                                                                                                                   | Ventajas                                                                                                                 | Por qué se descartó                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner_type` (enum) + `owner_id` (UUID opaco), sin FK, integridad solo de aplicación — mismo patrón que `audit_log.subject_type`/`subject_id` | Extensible sin migración si apareciera un tercer tipo de propietario                                                     | El conjunto de propietarios posibles es fijo y conocido (dos tipos, ambos del mismo schema) — a diferencia de `audit_log`, que audita _cualquier_ agregado presente y futuro de _cualquier_ schema; renunciar a integridad referencial real disponible sin necesidad sería una regresión de calidad de datos, no una ganancia de flexibilidad genuina |
| **Dos columnas FK nulables mutuamente excluyentes** (`customer_id`, `additional_driver_id`) + `CHECK` de exclusividad                         | Integridad referencial real vía FK normal; el `CHECK` hace explícita e irrompible la regla "pertenece a exactamente uno" | — (elegida)                                                                                                                                                                                                                                                                                                                                           |

**Decisión**: dos FK nulables + `CHECK ((customer_id IS NOT NULL) != (additional_driver_id IS NOT NULL))` (exclusividad estricta, ni ambos nulos ni ambos poblados).

## #4 — `payments.target_id` uniformemente opaco, sin FK ni siquiera hacia `security_deposits` (mismo schema)

**Contexto**: `Payment` referencia una `Invoice` (schema `rental`) o una `SecurityDeposit` (mismo schema `commerce`) según el tipo de cobro ([model/02-AGGREGATES.md §13](../model/02-AGGREGATES.md)).

**Alternativas consideradas**:

| Alternativa                                                                                                                                            | Ventajas                                                                                                                     | Por qué se descartó                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FK condicional: hacia `security_deposits` cuando `target_type = 'deposit'` (aprovechando que comparten schema), opaco cuando `target_type = 'invoice'` | Integridad referencial "gratis" en el caso `deposit`                                                                         | Introduce una asimetría de modelado que depende de un accidente de empaquetado físico (que ambos vivan hoy en `commerce`) — si `SecurityDeposit` se reubicara físicamente en el futuro, el tipo de constraint de esta columna cambiaría sin que la regla de negocio lo justifique; un desarrollador leyendo el schema tendría que recordar "por qué a veces sí y a veces no" sin una razón de dominio, solo de empaquetado |
| **`target_type` + `target_id` uniformemente opacos en ambos casos, integridad verificada en `application/`**                                           | Un único patrón de lectura del modelo, independiente de dónde vivan físicamente los dos posibles destinos hoy o en el futuro | — (elegida)                                                                                                                                                                                                                                                                                                                                                                                                                |

**Decisión**: `payments.target_id` nunca es FK, en ningún caso — la integridad se garantiza en el Command Handler que crea el `Payment` (valida que el `target_id` referenciado existe, vía el puerto correspondiente), coherente con el mismo principio ya aplicado a toda referencia inter-schema del modelo ([04-MODELO-DATOS.md §3](../04-MODELO-DATOS.md)).

## #5 — Columna `version` para concurrencia optimista en todo Aggregate Root

**Contexto**: ningún documento de dominio o de arquitectura ya aprobado fija un mecanismo de control de concurrencia para escrituras simultáneas sobre el mismo agregado (p. ej. dos operadores confirmando check-out sobre la misma `Reservation` casi simultáneamente).

**Alternativas consideradas**:

| Alternativa                                                                                                                               | Ventajas                                                                                                                                                                                                                                                                                                                                   | Por qué se descartó                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confiar únicamente en el nivel de aislamiento transaccional de PostgreSQL (`READ COMMITTED` por defecto)                                  | Cero columnas adicionales                                                                                                                                                                                                                                                                                                                  | Bajo `READ COMMITTED`, dos transacciones concurrentes pueden leer el mismo estado, decidir cada una una transición válida, y la segunda en persistir sobrescribe silenciosamente el efecto de la primera ("lost update") — exactamente el tipo de bug que un mecanismo de agregado transaccional (`UnitOfWork`, [technical/04-PERSISTENCE.md §3](../technical/04-PERSISTENCE.md)) debería impedir de forma mecánica, no solo esperar que no ocurra |
| Bloqueo pesimista (`SELECT ... FOR UPDATE`) en toda carga de agregado                                                                     | Previene la condición de carrera sin columna adicional                                                                                                                                                                                                                                                                                     | Introduce contención de bloqueos donde no siempre es necesaria (la mayoría de los agregados de este modelo no tienen alta concurrencia de escritura); es además más difícil de razonar bajo connection pooling en modo _transaction_ ya fijado para RLS ([technical/04-PERSISTENCE.md §5](../technical/04-PERSISTENCE.md))                                                                                                                         |
| **Columna `version` (entero, incrementado en cada `UPDATE`) en todo Aggregate Root, verificada en la cláusula `WHERE` de cada escritura** | Detecta la colisión sin bloqueo pesimista; el repositorio simplemente falla la escritura (y el Command Handler puede reintentar o informar conflicto) si `version` no coincide — mecánico, barato, y coherente con que "un agregado se carga, se modifica y se persiste como unidad" ([model/02-AGGREGATES.md](../model/02-AGGREGATES.md)) | — (elegida)                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**Decisión**: `version` en todo Aggregate Root (nunca en entidades internas, que se persisten siempre junto a su raíz en la misma transacción y por tanto están protegidas por la versión de su raíz). Para `AvailabilitySlot`, `version` es una capa adicional a la ya existente (exclusion constraint), no un reemplazo.

## #6 — Unicidad de `vehicles.license_plate`: punto abierto, no decidido unilateralmente

**Contexto**: una placa vehicular identifica, en el mundo físico, un único vehículo — una intuición razonable de unicidad. El catálogo de invariantes aprobado ([model/07-INVARIANTS.md](../model/07-INVARIANTS.md)) no declara esta regla explícitamente.

**Decisión**: este documento **no** introduce una constraint de unicidad sobre `license_plate` (ni por `company_id`, ni global) por iniciativa propia. Introducir una restricción de negocio que el modelo de dominio aprobado no fijó violaría el mandato explícito de esta fase ("no introducir nuevas reglas de negocio"). Se deja registrado como pregunta abierta para el equipo de dominio antes de implementar: ¿debe existir esa unicidad, a qué nivel de scoping (por `Company`, por país, global), y qué hacer con el caso legítimo de una placa reasignada por la autoridad de tránsito tras la baja de un vehículo anterior? Ninguna de estas preguntas tiene una respuesta derivable mecánicamente de la documentación ya aprobada.

## #7 — Tabla `price_adjustments` no listada explícitamente como tabla en el modelo de dominio

**Contexto**: `PriceAdjustment` está clasificado en [model/04-VALUE_OBJECTS.md §5.2](../model/04-VALUE_OBJECTS.md) como Value Object compuesto dentro de `PriceBreakdown`, con la justificación explícita de que "no tiene ciclo de vida propio tras registrarse... es una lista append-only de hechos inmutables". Esa misma descripción ("append-only", "cada ajuste ocurre en un momento distinto") es estructuralmente idéntica a la de `Rate` y `Charge`, ambas modeladas como **entidades** con tabla propia.

**Análisis**: la clasificación de dominio (VO vs. entidad) responde a si el elemento tiene identidad de negocio referenciable desde fuera de su agregado — `PriceAdjustment` no la tiene, por eso es VO. La necesidad de tabla propia responde a una pregunta distinta y ortogonal: si el elemento necesita persistirse con historial propio sin perder versiones anteriores al agregar una nueva — y aquí sí la necesita, exactamente como `Rate`/`Charge`. Ambas preguntas coinciden la mayoría de las veces en este modelo (toda entidad necesita tabla propia con historial) pero no son la misma pregunta, y `PriceAdjustment` es el único punto donde divergen.

**Decisión**: se agrega `rental.price_adjustments`, tratada a efectos físicos exactamente como una entidad interna append-only de `Reservation` (mismo patrón que `charges` de `Invoice`), sin que esto reclasifique `PriceAdjustment` como entidad en el modelo de dominio — la reclasificación, si el equipo de dominio la considera necesaria, es una decisión de [docs/model/](../model/README.md), no de este documento. Eleva el conteo total de tablas de 30 a 31.

## #8 — No se agrega un tercer exclusion constraint sobre `reservations`

**Contexto**: INV-102 (no-solapamiento de reservas activas sobre el mismo vehículo) ya tiene defensa en profundidad explícitamente asignada por [model/07-INVARIANTS.md §6](../model/07-INVARIANTS.md) a dos capas: `AvailabilityService` (aplicación) y el exclusion constraint de `availability_slots` (base de datos, Scheduling).

**Decisión**: este modelo físico **no** agrega un exclusion constraint adicional sobre `reservations(vehicle_id, date_range)`, aunque sería técnicamente posible y "más seguro" en apariencia. Hacerlo introduciría una tercera capa de defensa no solicitada por el modelo de dominio aprobado, y contradiría el propio criterio de ese documento de que solo cuatro invariantes (INV-102, INV-P01, INV-021, INV-024) justifican doble capa — añadir una capa adicional sin necesidad real es precisamente el tipo de sobreingeniería que [00-VISION.md §3](../00-VISION.md) prohíbe. Se documenta esta ausencia explícitamente para que un futuro desarrollador no la interprete como un olvido.

## #9 — `CHECK (end > start)` como segunda capa nueva para INV-001

**Contexto**: INV-001 (`endDate > startDate`) es 🔴 Crítica pero no aparece en la tabla oficial de doble capa de [model/07-INVARIANTS.md §6](../model/07-INVARIANTS.md) — hoy se protege únicamente en el VO `DateRange` del dominio.

**Alternativas consideradas**:

| Alternativa                                                                        | Ventajas                                                                                                                                                                                                       | Por qué se descartó / eligió                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mantener una sola capa (el VO de dominio)                                          | Cero cambio, fiel estrictamente a lo ya documentado                                                                                                                                                            | Un `CHECK` sobre dos columnas de la misma fila tiene costo de mantenimiento nulo (no requiere índice, no requiere extensión, no coordina con otras filas) — el costo de agregarlo es tan bajo que no agregarlo sería inconsistente con el resto del modelo, que sí invierte en defensa en profundidad barata en otros puntos |
| **Agregar `CHECK (end > start)` en `reservations`, `availability_slots`, `rates`** | Protege contra un bug de un futuro repositorio o script administrativo que escriba directamente sin pasar por el VO de dominio (p. ej. un backfill de migración, §2 de [07-MIGRACIONES.md](07-MIGRACIONES.md)) | — (elegida)                                                                                                                                                                                                                                                                                                                  |

**Decisión**: se agrega como constraint nuevo, documentado explícitamente aquí para no dar la impresión de que el catálogo de invariantes aprobado ya lo exigía — es una decisión de este documento, no una relectura de [model/07-INVARIANTS.md](../model/07-INVARIANTS.md).

## #10 — Rol `migrator` (propietario) distinto de `app_runtime` (RLS aplicado) + `FORCE ROW LEVEL SECURITY`

**Contexto**: PostgreSQL exime por defecto al propietario de una tabla de sus propias políticas RLS — un hecho del motor que ningún documento anterior de `docs/` hace explícito, pero que determina si RLS tiene algún efecto real.

**Decisión**: dos roles de PostgreSQL separados — `migrator` (propietario de todo el esquema, usado solo por Prisma Migrate) y `app_runtime` (usado por el `PrismaClient` de `apps/api`, sin privilegio de propietario, sujeto a RLS) — más `FORCE ROW LEVEL SECURITY` en toda tabla como segunda salvaguarda contra un futuro cambio accidental de propietario. Sin esta separación, la "defensa en profundidad" de [ADR-0004](../ADR/0004-multitenancy.md) (aplicación + RLS) se reduciría de hecho a una sola capa real. Ver desarrollo completo en [06-RLS.md §3](06-RLS.md).

## #11 — Query Handlers de solo lectura también requieren una transacción para `SET LOCAL`

**Contexto**: [technical/04-PERSISTENCE.md §3](../technical/04-PERSISTENCE.md) fija que un Query Handler "usa el `PrismaClient` de scope de aplicación... sin necesidad de UoW" — una afirmación correcta sobre el `UnitOfWork` de escritura+outbox, pero que podría leerse erróneamente como "sin necesidad de transacción en absoluto". `SET LOCAL` (mecanismo de RLS, [technical/04-PERSISTENCE.md §5](../technical/04-PERSISTENCE.md)) solo tiene efecto dentro de una transacción activa.

**Decisión**: todo Query Handler ejecuta dentro de una transacción de solo lectura ligera, cuyo único propósito es dar alcance a `SET LOCAL app.current_company_id` — un mecanismo distinto del `UnitOfWork` de comandos (que además coordina el Outbox), aunque ambos usen `prisma.$transaction` como primitiva de Prisma. Se documenta aquí porque, sin esta aclaración, un desarrollador podría implementar un Query Handler que se conecta sin transacción, y ver todas sus consultas denegadas por la política RLS fail-closed ([06-RLS.md §1.4](06-RLS.md)) — o peor, that alguien "resuelva" el síntoma cambiando `current_setting(...)` a una forma que no falle cerrado, reabriendo el riesgo que RLS existe para prevenir.

## #12 — Enums nativos de PostgreSQL (vía Prisma `enum`) en vez de `String` + `CHECK`

**Contexto**: toda enumeración cerrada de Value Objects del modelo de dominio (`ReservationStatus`, `VehicleStatus`, `PaymentStatus`, etc.) necesita una representación de columna.

**Alternativas consideradas**:

| Alternativa                                      | Ventajas                                                                                                                                                                                                                            | Por qué se descartó / eligió                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `String` + `CHECK (status IN (...))`             | Agregar un valor nuevo al catálogo no requiere `ALTER TYPE` (una operación con restricciones históricas de PostgreSQL, aunque PG 12+ permite `ADD VALUE` fuera de una transacción explícita sin bloqueo mayor)                      | Columna más pesada en almacenamiento e índice frente a un enum nativo; el `CHECK` debe mantenerse manualmente sincronizado con el VO de dominio sin la garantía de tipo que Prisma genera automáticamente a partir de un `enum`                                                                                                                                                                                                                                                                         |
| **Enum nativo de Prisma (`ENUM` de PostgreSQL)** | Tipado end-to-end automático (el enum de Prisma genera el tipo TypeScript correspondiente sin mapeo manual); almacenamiento más compacto; el propio motor rechaza un valor fuera de catálogo sin necesidad de un `CHECK` redundante | Agregar un valor nuevo es una migración `ALTER TYPE ... ADD VALUE`, ejecutada como su propia migración (no dentro de una transacción que también la usa, restricción real de PostgreSQL) — aceptado como trade-off menor porque las máquinas de estado de este modelo ([model/08-STATE_MACHINES.md](../model/08-STATE_MACHINES.md)) son deliberadamente estables y cualquier estado nuevo ya requeriría, de todos modos, revisar la máquina de estados completa en el dominio antes de tocar el esquema |

**Decisión**: enum nativo de Prisma para toda enumeración cerrada de estado; arreglo de `String`/enum para conjuntos configurables simultáneos (`PaymentMethodsEnabled`, `EnabledProductModules`), donde la cardinalidad múltiple (no la volatilidad del catálogo) es la razón de la diferencia de tratamiento. Ver desarrollo completo en [08-PRISMA-CONVENTIONS.md §7](08-PRISMA-CONVENTIONS.md).

## #13 — `UnitOfWork.run()`/`ReadTransaction.run()` aceptan un `companyId` explícito, no solo `RequestContext`

**Contexto**: ambos mecanismos (§11 de este documento para `ReadTransaction`; [technical/04-PERSISTENCE.md §3](../technical/04-PERSISTENCE.md) para `UnitOfWork`) se diseñaron asumiendo que `RequestContext` — poblado por `TenantContextGuard` a partir de un JWT ya validado — siempre está disponible. Los tres comandos de `platform-identity` (`Login`, `RefreshSession`, `RevokeSession`) corren en rutas `@Public()` — por diseño, sin JWT que validar todavía — pero cada uno ya conoce el `companyId` relevante por otra vía (el body de login; la `Session`/`User` ya encontrada por hash de refresh token). Sin este ajuste, el primer intento de login real del sistema fallaba con `RequestContext no inicializado` — bug real encontrado al ejecutar el flujo, no en revisión de código.

**Decisión**: ambos métodos aceptan un segundo parámetro opcional `companyId?: string`; si se omite, se comportan exactamente como antes (`RequestContext.get()`). Los tres comandos de `platform-identity` lo pasan siempre explícito; el resto del código (rutas autenticadas) no cambia.

## #14 — RLS de `sessions`: GUC nombrado y acotado para la búsqueda por `refresh_token_hash`

**Contexto**: `RefreshSession`/`RevokeSession` necesitan encontrar una `Session` por su `refresh_token_hash` **antes** de saber a qué `company_id` pertenece (no hay JWT en `@Public()`) — la política de aislamiento de tenant (`company_id = current_setting('app.current_company_id')`) no puede satisfacerse en ese momento, porque el valor de `company_id` es precisamente lo que la consulta busca descubrir.

**Alternativas consideradas**: ver discusión completa registrada en la conversación de implementación — función `SECURITY DEFINER` (más aislada pero requiere `$queryRaw` y mantenimiento manual sincronizado con el modelo) y `BYPASSRLS` en `app_runtime` (descartada: elimina la segunda capa de defensa, [ADR-0004](../ADR/0004-multitenancy.md), para **todas** las tablas, no solo `sessions`).

**Decisión**: `refresh_token_hash` es único globalmente (`sessions_refresh_token_hash_key`, secreto de 256 bits) — conocer el valor en texto plano **es** la autorización real, no la pertenencia a un tenant. La política de `identity.sessions` se amplía con una segunda cláusula: `OR current_setting('app.session_lookup_by_hash', true) = 'true'`. Ese GUC lo fija **exclusivamente** `PrismaSessionRepository.findByRefreshTokenHash`, en su propia transacción mínima, nunca junto con una escritura ni con ningún otro método del repositorio. Migración: `20260815050000_sessions_lookup_by_hash_rls`.

## #15 — `outbox_event.aggregate_id` es `TEXT` opaco, no `UUID`

**Contexto**: [02-TABLAS.md §6](02-TABLAS.md) ya describe `aggregate_id` como "valor opaco, nunca FK hacia el agregado que lo originó" — pero la primera versión de este modelo lo tipó `@db.Uuid`, asumiendo sin verificarlo que todo evento se origina en un agregado con `EntityId` real. `LoginFailed.v1` (evento nuevo de `platform-identity`, sin `Session` ni `User` reales cuando el email no existe) rompió ese supuesto en el primer intento de login fallido real: `invalid input syntax for type uuid: "smoke@example.com"`.

**Decisión**: `aggregate_id` es `TEXT`, consistente con la descripción ya documentada de "opaco". `LoginFailed.v1` usa el email presentado como `aggregate_id` (identificador del intento, no de un agregado persistido). Migración: `20260815043607_outbox_event_aggregate_id_opaque`.

## #16 — `OutboxRelayWorker` no se construye en esta tanda (Identity & Access) — gap de durabilidad aceptado

**Contexto**: la tabla `outbox_event` y la escritura atómica (misma transacción que el cambio de estado, vía `PrismaUnitOfWork`/`OutboxWriter`) sí se construyeron; el worker (BullMQ) que reintenta la publicación de eventos no confirmados tras un crash del proceso, descrito en [technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md), no.

**Decisión**: se acepta el gap explícitamente por ahora. Alcance real: una fila de `outbox_event` queda con `published_at IS NULL` únicamente si el proceso de `apps/api` muere en la ventana exacta entre el commit de la transacción y la confirmación en memoria — no hay pérdida de datos de negocio (el `User`/`Role`/`Session` ya está persistido), solo de la notificación del evento. No hay ningún consumidor de eventos todavía (`Audit`, Fase 0 ítem 7, no existe) — construir el worker antes que exista al menos un consumidor real habría sido trabajo sin forma de verificarse. Queda como ítem pendiente explícito para cuando `Audit` (u otro consumidor) se construya.

## #17 — Bootstrap RLS de `companies`: `WITH CHECK` implícito vía id generado en dominio

**Contexto**: `organization.companies` es la única tabla cuya política RLS compara su propio `id`, no `company_id` ([06-RLS.md §4.1](06-RLS.md)) — es la raíz de tenant, no tiene un tenant "padre" que la escope. Registrar una `Company` nueva (`POST /companies`, `@Public()`) es la primera escritura sobre esa fila: en ese momento no existe ningún `app.current_company_id` legítimo todavía, porque la company que lo definiría es precisamente la que se está creando.

**Decisión**: sin necesidad de ningún GUC de bypass nuevo (a diferencia de `sessions.refresh_token_hash`, §14). `Company.create()` genera el `id` en `domain/` (`EntityId.generate<'Company'>()`) antes de persistir — mismo patrón que todo agregado del modelo. `RegisterCompanyHandler` llama `unitOfWork.run(work, company.id.toString())`, fijando `SET LOCAL app.current_company_id` a ese mismo id antes del `INSERT`. Postgres usa la expresión `USING` como `WITH CHECK` quando una política no define uno explícito — como la fila insertada tiene exactamente `id = app.current_company_id`, el chequeo pasa de forma natural. Verificado con un `INSERT` real contra Postgres (no solo en teoría): visible bajo su propio contexto, invisible bajo cualquier otro.

**Bug real encontrado en el camino**: la primera versión de la migración `organization_rls` olvidó `GRANT USAGE ON SCHEMA organization TO app_runtime` (la migración `identity_rls` sí lo tenía) — el primer `INSERT` de prueba falló con `permission denied for schema organization`, antes de llegar siquiera a evaluar la política RLS. Corregido en el mismo commit que introdujo la migración, nunca llegó a un commit separado.

## #18 — `DuplicateTaxIdError` se detecta atrapando el constraint único de Postgres, no con un pre-check

**Contexto**: INV-016 (`TaxId` único a nivel de Plataforma) es la única unicidad verdaderamente global del modelo — todas las demás (p. ej. `Email` de `User`, INV-014) están scopeadas por `company_id`. Un pre-check típico (`SELECT ... WHERE tax_id = $1` antes del `INSERT`) fallaría bajo RLS: la política de `companies` solo deja ver "la propia" (§4.1), y durante el registro de una company nueva no existe ninguna "propia" todavía — el pre-check buscaría cruzando todas las companies existentes exactamente en el momento en que RLS se lo impide.

**Decisión**: `PrismaCompanyRepository.save()` intenta el `INSERT`/`UPDATE` directamente y atrapa el código de constraint único de Postgres (Prisma `P2002`), traduciéndolo a `DuplicateTaxIdError`. Ventaja adicional sobre un pre-check (más allá de esquivar el problema de RLS): elimina la carrera TOCTOU entre el `SELECT` y el `INSERT` que un pre-check tendría de todos modos bajo escritura concurrente.

## #19 — `OutboxRelayWorker` sigue sin construirse (extiende la decisión #16 a Organization)

**Contexto**: `CompanyRegistered.v1`/`CompanySuspended.v1`/`BranchOpened.v1`/`BranchClosed.v1` se escriben en `outbox_event` de la misma forma que los eventos de Identity & Access (§16) — mismo mecanismo, mismo gap.

**Decisión**: sin cambios respecto a §16 — se documenta aquí solo para dejar constancia de que Organization no introdujo ninguna excepción a esa decisión ya tomada.

## #20 — `OutboxWriter` nunca emitía a ningún bus in-process (bug real, no una omisión de alcance)

**Contexto**: al construir Audit (Fase 0 ítem 7, primer consumidor real de eventos) se encontró que `OutboxWriter.publish()` — la única implementación de `DomainEventPublisher` que usan todos los módulos ya construidos vía `UnitOfWork.run()` — solo insertaba la fila en `outbox_event`; nunca llamaba a `EventEmitter2.emit(...)`, ni existía `@nestjs/event-emitter` como dependencia. Ningún evento de ningún módulo (Identity, Users, Roles, Companies, Branches) había llegado jamás a un listener in-process.

**Decisión**: se agrega el emit dentro de `OutboxWriter.publish()` mismo (no en cada Command Handler), justo después del `INSERT` exitoso, fire-and-forget (`emit()`, no `emitAsync()` — un fallo del listener de Audit nunca debe hacer fallar la operación de negocio que lo originó). Al vivir en el único punto compartido por todos los módulos, este único cambio cubre retroactivamente Identity/Users/Roles/Companies/Branches sin tocar ningún Command Handler existente — confirmado con el e2e de Audit, que ve `SessionCreated.v1` (Identity) auditado correctamente sin que ese módulo se haya modificado.

## #21 — Patrón de wildcard de `EventEmitter2`: `'**'`, no `'*'` como decían los docs

**Contexto**: [technical/05-EVENTING.md §5](../technical/05-EVENTING.md) describe el listener catch-all de Audit como suscrito a `'*'`. Los `eventType` reales tienen la forma `Nombre.vN` (dos segmentos separados por `.`, el delimitador por defecto de `EventEmitter2` en modo `wildcard`) — un `@OnEvent('*')` de un solo nivel no captura un evento de dos segmentos.

**Decisión**: `EventEmitterModule.forRoot({ wildcard: true })` + `@OnEvent('**')` (doble comodín, cruza niveles) en `DomainEventAuditListener`. Verificado empíricamente, no solo asumido: el e2e de Audit confirma la captura real de `CompanyRegistered.v1`, `SessionCreated.v1` y `BranchOpened.v1` bajo este patrón. La doc de eventing queda desactualizada en ese punto puntual — se corrige aquí como referencia hasta que se actualice directamente.

## #22 — `AuditLogEntry` sin `version` (única excepción a la decisión #5)

**Contexto**: la decisión #5 fija `version` en todo Aggregate Root para concurrencia optimista. `AuditLogEntry` es append-only estricto (INV-024, [model/07-INVARIANTS.md §1/§6](../model/07-INVARIANTS.md)) — nunca hay una segunda escritura sobre la misma fila con la que la primera pueda entrar en conflicto.

**Decisión**: se omite `version` deliberadamente. Segunda capa de defensa de INV-024, independiente de RLS: `GRANT SELECT, INSERT ON support.audit_log TO app_runtime` sin `UPDATE`/`DELETE` — un `REVOKE` a nivel de motor (RLS filtra filas, `GRANT` filtra qué operaciones existen del todo), verificado con un test de integración real que confirma que `app_runtime` recibe `permission denied for table audit_log` en ambos intentos.

## #23 — `OutboxRelayWorker` sigue diferido (extiende #16/#19 — ahora con un consumidor real)

**Contexto**: Audit es el consumidor real que §16 nombraba como condición para reconsiderar el worker de BullMQ que reintenta la publicación de eventos no confirmados tras un crash de proceso.

**Decisión**: se difiere de nuevo, con la razón actualizada. El emit inmediato in-process (§20) cubre el caso feliz (>99%): el gap remanente — un evento se pierde solo si `apps/api` muere en la ventana exacta entre el commit de la transacción y el emit en memoria — no compromete ningún dato de negocio, únicamente esa fila puntual de auditoría. No se construye tampoco `event_consumption_log` ([technical/05-EVENTING.md §3](../technical/05-EVENTING.md), tabla de idempotencia para reintentos) — sin `OutboxRelayWorker`, no existe ningún mecanismo que reemita un evento ya entregado, así que el riesgo de entrega duplicada que esa tabla resuelve no existe todavía. Mismo criterio en ambos casos: se construye cuando haya un escenario real de reintento que lo necesite, no antes.

## #24 — `GET /audit-log` es consistente-eventual respecto al request que disparó el evento, no consistente-inmediato

**Contexto**: consecuencia directa, no anticipada explícitamente hasta encontrarla, del emit fire-and-forget de §20. `OutboxWriter.publish()` llama `EventEmitter2.emit(...)` sin esperar a que `DomainEventAuditListener.handle()` (async, hace su propio `INSERT` a `support.audit_log`) termine — el request de negocio (p. ej. `POST /branches`) responde 201 en cuanto su propia transacción hace commit, sin esperar al listener. El e2e de Audit, al hacer `GET /audit-log` inmediatamente después del `POST /branches` en la misma corrida, resultó **flaky de verdad** (Nx lo marcó como "flaky task" en una corrida real, no una sospecha teórica): a veces la fila de `BranchOpened.v1` todavía no existía cuando llegaba la lectura.

**Decisión**: no se cambia el emit a `emitAsync()` ni se acopla el request de negocio a la escritura de auditoría — eso reintroduciría exactamente el riesgo que el fire-and-forget evita a propósito (un fallo o lentitud de Audit haciendo fallar o demorar una operación de negocio). Se documenta el comportamiento como contrato explícito: cualquier consumidor de `GET /audit-log` (incluidos tests) debe tratarlo como eventual, nunca asumir visibilidad sincrónica inmediatamente después del request que originó el evento. El e2e correspondiente hace polling corto (intervalos de 100ms, tope 5s) en vez de una lectura única.

## #25 — RLS de `support.files` es el grant estándar completo, no el patrón append-only de `audit_log`

**Contexto**: `support.files` es la segunda tabla del schema `support` (junto a `audit_log`) — con la sola precedencia de `audit_log` (append-only por INV-024, §22), había riesgo de copiar por hábito su migración `GRANT SELECT, INSERT` restringido.

**Decisión**: `support.files` recibe `GRANT SELECT, INSERT, UPDATE, DELETE` (mismo patrón que `organization.companies`/`organization.branches`), porque el "delete" de `File` es una actualización lógica real (`UPDATE upload_status`), no un registro inmutable — a diferencia de `AuditLogEntry`, donde nunca hay una segunda escritura legítima sobre la misma fila. El test de integración de RLS confirma explícitamente lo contrario de lo que confirma el de `audit_log`: `app_runtime` **sí** puede `UPDATE` bajo su propio contexto de tenant.

## #26 — Bug real: `OutboxWriter` no tenía `File` en `AGGREGATE_TYPE_TO_SCHEMA`

**Contexto**: el mapeo `aggregateType → sourceSchema` de `OutboxWriter` (§20, agregado al construir Audit) solo cubría los aggregate types que existían en ese momento (`User`/`Role`/`Session` → `identity`, `Company`/`Branch` → `organization`). El smoke test manual de Files (`POST /files/confirm-upload` real, con Postgres+Redis+MinIO reales) devolvió `500` con el error `OutboxWriter: aggregateType "File" no tiene schema mapeado` — nadie había agregado la entrada al construir el módulo.

**Decisión**: se agrega `File: 'support'` al mapa. Encontrado por una corrida real, no por inspección de código — mismo criterio de rigor que el resto de la sesión (correr el código, no solo leerlo). Sirve como recordatorio operativo: todo módulo nuevo que publique eventos de dominio debe agregar su(s) aggregate type(s) a este mapa, o falla en runtime recién en el primer intento real de publicar (no en typecheck ni en lint).

## #27 — Enforcement de `contentType`/tamaño en Files: asimétrico, y el diseño original sobre `contentType` era incorrecto

**Contexto**: el diseño original (plan de implementación) asumía que fijar `ContentType` en el `PutObjectCommand` antes de generar la URL firmada dejaba ese header firmado — un `PUT` con un `Content-Type` distinto habría sido rechazado por storage antes de aceptar ningún byte (enforcement preventivo). El test de integración real contra MinIO refutó esto: un `PUT` con `Content-Type: image/png` contra una URL firmada para `application/pdf` fue aceptado con `200`. Inspeccionando `@aws-sdk/s3-request-presigner` se confirmó la causa: `prepareRequest()` agrega `"content-type"` a `unsignableHeaders` de forma incondicional — es el comportamiento estándar del SDK (las URLs firmadas están pensadas para ser usables sin que el cliente tenga que fijar headers arbitrarios), no un bug de MinIO ni de esta implementación.

**Decisión**: el enforcement real de `contentType` (igual que el de tamaño, que nunca tuvo una vía preventiva disponible dado que el puerto `getUploadUrl` no recibe un tamaño esperado) es **post-hoc, en `ConfirmUploadHandler`**, comparando lo que `verifyUploadedObject` (`HeadObjectCommand`) midió realmente contra el allowlist — nunca lo que el cliente declaró. Ambos casos, si fallan, intentan un `deleteObject` best-effort (mismo criterio ya aceptado en `docs/contracts/05-INTEGRATION-CONTRACTS.md` §3 para cualquier `confirmUpload` fallido: un objeto huérfano no es una obligación de consistencia inmediata). Gap aceptado explícitamente: entre el `PUT` y el `confirmUpload`, un objeto con contentType o tamaño inválido puede existir transitoriamente en el bucket.

## #28 — `GetSignedUrl` es un Command de `application/`, no una Query de `infrastructure/queries/`

**Contexto**: a diferencia de `GetCompanyHandler`/`ListAuditLogHandler` (leen directo de Postgres vía `ReadTransaction`, sin pasar por el modelo de dominio — la definición de "Query" de [ADR-0007]), `GetSignedUrl` necesita cargar el agregado `File` real para exigir el invariante "un `File` `Deleted` no puede generar una nueva URL firmada" ([model/02-AGGREGATES.md §15](../model/02-AGGREGATES.md)) y dispara un efecto externo no-idempotente (una URL firmada nueva en cada llamada).

**Decisión**: vive en `files/application/src/commands/get-signed-url/`, usa `FILE_REPOSITORY` (no `ReadTransaction`), y es el único Command del módulo que no usa `UnitOfWork` (no hay nada que persistir). Documentado con un comentario explícito en el propio handler para que no se "corrija" moviéndolo a `infrastructure/queries/` en el futuro.

## #29 — `FileAlreadyConfirmedError`: doble `confirmUpload` con la misma `storageRef`

**Contexto**: gap encontrado al diseñar `PrismaFileRepository` — nada en el flujo impide que un cliente llame `confirmUpload` dos veces con la misma `storageRef` (p. ej. un retry de red tras un timeout de la primera respuesta, ya exitosa). `storage_ref` es `UNIQUE` a nivel de tabla.

**Decisión**: el segundo `INSERT` dispara `P2002`, atrapado en `PrismaFileRepository.save()` y traducido a `FileAlreadyConfirmedError` (`409 FILE_ALREADY_CONFIRMED`) — mismo patrón exacto que `DuplicateTaxIdError` en `PrismaCompanyRepository` (§18): la unicidad se valida atrapando el constraint de Postgres, no con un pre-check.

## #30 — Settings (`CompanySettings`) acotado a 2 de las 9 políticas documentadas

**Contexto**: `docs/model/02-AGGREGATES.md` §6 documenta 9 Value Objects de política (`CancellationPolicy`, `DepositPolicy`, `LateReturnPolicy`, `MaintenanceThresholdPolicy`, `PaymentMethodsEnabled`, `DraftExpirationPolicy`, `MinimumBookingLeadTime`, `NotificationChannelPreference`, `EnabledProductModules`). Solo los 2 últimos tienen forma de campos realmente decidida en los docs — los otros 7 son reglas de negocio de Rental Operations (Fase 1, no construido todavía), documentados con una sola línea de gloss cada uno, sin unidades, sin cantidad de tramos, sin defaults. `docs/persistence/04-COLUMNAS-CONCEPTUALES.md` prohíbe además JSONB como placeholder para ellos ("cada política como grupo de columnas propio... nunca JSONB de negocio").

**Decisión**: esta tanda construye `CompanySettings` completo como aggregate, pero solo con `EnabledProductModules` y `PaymentMethodsEnabled`. Las otras 7 políticas quedan como gap explícito, mismo criterio que `OutboxRelayWorker` (§16/§19/§23) — se construyen cuando Rental Operations les dé forma real, no antes. Esto no bloquea el criterio de salida de Fase 0 (`docs/01-ROADMAP.md` §2, que no menciona Settings explícitamente) y desbloquea `TenantModuleEnabledGuard`, el motivo original por el que Settings está en el roadmap.

## #31 — `CompanySettings` es el primer aggregate root con identidad prestada, no generada

**Contexto**: `docs/model/03-ENTITIES.md` §2.3 llama a `CompanySettings` "la única entidad... cuya identidad es directamente la de otra entidad" — coincide 1:1 con `CompanyId`, no genera la suya propia.

**Decisión**: `companyId` es un `string` plano (no un `CompanyId` importado de `@platform/companies/domain` — `type:domain` de un módulo no puede depender del `type:domain` de otro, `tooling/eslint/boundaries.mjs`), mismo criterio ya usado para `AuditLogEntry.companyId`/`File.companyId`. En Prisma, `company_id` es literalmente la columna `@id` (sin columna `id` autónoma), sin `@relation`/FK real hacia `companies` — mismo patrón ya usado para `branches.company_id` (verificado: esa migración tampoco tiene `FOREIGN KEY`, la integridad la garantiza RLS + la aplicación). RLS estándar (`company_id = current_setting(...)`), no el caso especial de `companies` (que compara su propio `id` porque es la raíz de tenant) — `company_settings.company_id` es una columna normal, aunque también sea la PK.

## #32 — `EnabledProductModules` se modela `String[]`, no un enum nativo de Postgres

**Contexto**: `docs/persistence/08-PRISMA-CONVENTIONS.md` §7 llama a `EnabledProductModules`/`PaymentMethodsEnabled` "conjunto cerrado de un catálogo" (sugiriendo enum nativo para ambos), mientras que `docs/contracts/08-VERSIONING.md` §5 dice lo opuesto para `EnabledProductModules` específicamente: "un consumidor los trata como conjuntos abiertos por diseño de dominio... nunca como una lista cerrada exhaustiva", y `docs/model/02-AGGREGATES.md` §6 solo compromete `Rental` como valor real hoy ("extensible a `Workshop`, etc.").

**Decisión**: se resuelve a favor de la lectura de `08-VERSIONING.md` — `enabled_product_modules` es `TEXT[]` (validado solo por no-vacío en el dominio, nunca contra un catálogo cerrado), agregar un producto nuevo no requiere migración. `PaymentMethodsEnabled` sí es un enum nativo (`PaymentMethod[]`) — ese catálogo de 4 valores (`docs/model/04-VALUE_OBJECTS.md` §6) no tiene la misma cláusula de "conjunto abierto" en ningún documento.

## #33 — `CompanySettings` se crea junto con `Company`, orquestado sin cruzar el límite de dominio entre módulos

**Contexto**: `docs/persistence/07-MIGRACIONES.md` §5.2 fija que `CompanySettings` con sus defaults se crea "junto con cada `Company` nueva... siempre inserta ambas filas... en la misma transacción" — comportamiento normal del Command Handler de alta, no una reacción a evento. Pero `companies/application` (donde vive `RegisterCompanyHandler`) no puede importar `settings/domain` directamente (eje de módulo de `tooling/eslint/boundaries.mjs`: `type:domain` solo depende de sí mismo/`scope:shared`).

**Decisión**: `CreateDefaultSettingsHandler` vive en `settings/application` (mismo módulo que `CompanySettings`), expone `execute(params, tx)` tomando el `tx` ya abierto por el propio `UnitOfWork.run()` de `RegisterCompanyHandler` — este último orquesta llamándolo, nunca construye `CompanySettings` él mismo. `CompaniesModule` importa `SettingsModule` (no solo el token) para resolverlo, mismo mecanismo ya usado para `UsersModule` → `CompaniesModule`. Sin evento de creación (ver #34) — nada que publicar desde `RegisterCompanyHandler` en nombre de Settings.

## #34 — `CompanySettings.create()` no emite ningún evento

**Contexto**: el catálogo (`docs/model/06-DOMAIN_EVENTS.md` §4) solo lista `CompanySettingsUpdated.v1` — por su propio nombre, reacciona a un cambio real de una política existente, no a la fijación inicial de defaults.

**Decisión**: mismo criterio ya usado para `Company.reactivate()`/`User.reactivate()` — una transición sin evento propio porque no está en el catálogo. Los 2 métodos de actualización (`updateEnabledProductModules`/`updatePaymentMethods`) sí emiten `CompanySettingsUpdated.v1`, con `newValueSummary` como `JSON.stringify` del nuevo valor (formato no especificado en ningún documento, resuelto con la opción más simple).

## #35 — Bug real: `OutboxWriter` tampoco tenía `CompanySettings` en `AGGREGATE_TYPE_TO_SCHEMA`

**Contexto**: mismo patrón exacto que el bug de `File` (#26) — el smoke test manual de `PATCH /company-settings/payment-methods-enabled` (Postgres+Redis reales) devolvió `500` con `OutboxWriter: aggregateType "CompanySettings" no tiene schema mapeado`.

**Decisión**: se agrega `CompanySettings: 'organization'` al mapa. Segunda vez en la misma sesión que este mapa queda desactualizado al agregar un módulo nuevo — confirma el patrón ya anotado en #26: todo módulo que publique eventos de dominio debe agregar su(s) aggregate type(s) aquí, o falla recién en el primer intento real de publicar, nunca en typecheck ni en lint.

## #36 — `Customer`, primer aggregate con entidades internas en tablas propias: persistencia con dirty-tracking

**Contexto**: `IdentityDocument`/`AdditionalDriver` son entidades internas de `Customer` con sus propias tablas Prisma (`identity_documents`, `additional_drivers`) — primera vez en el proyecto que un aggregate tiene hijos persistidos por separado, no embebidos como JSON ni en la misma fila.

**Decisión**: `Customer` trackea qué hijos se tocaron en la operación actual (`dirtyDocumentIds`/`dirtyDriverIds`, `Set<string>`), expuesto vía `pullDirtyIdentityDocuments()`/`pullDirtyAdditionalDrivers()` — mismo idioma que `pullDomainEvents()` (acumular, filtrar-y-limpiar al leer). `PrismaCustomerRepository.save()` solo escribe los hijos dirty, nunca reemplaza la colección completa. Se descartó la API de nested-writes de Prisma (`update: { set: [...] }`) porque implica borrar-y-recrear toda la colección en cada `save()`, lo cual es incorrecto para `identity_documents` (append-only — un documento "borrado y recreado" perdería su historial real de estados).

## #37 — `PhoneNumber` y `CustomerName`: gaps completados

**Contexto**: `PhoneNumber` estaba catalogado en `docs/model/04-VALUE_OBJECTS.md §1.5` como VO "verdaderamente universal" pero nunca se implementó (ningún consumidor hasta Customers). `CustomerName` no estaba catalogado en ningún doc pese a que todo otro aggregate tiene su propio VO de nombre (`User.PersonName`, `Branch.BranchName`, `Company.LegalName`).

**Decisión**: `PhoneNumber` se agrega a `shared-kernel` (formato E.164), `CustomerName` se agrega al módulo `customers/domain` siguiendo el precedente exacto de `BranchName` (2-120 caracteres). `BillingContact` (`Company`) deliberadamente NO se retrofitea a `PhoneNumber` — su teléfono queda como string opcional plano, inconsistencia aceptada.

## #38 — `Customer` tiene dos dimensiones de estado ortogonales, no una cadena de 3

**Contexto**: `docs/model/08-STATE_MACHINES.md §6.5` mostraba `Registered → Active → Blocked` como una sola cadena, pero `CustomerBlockStatus` está documentado aparte como VO propio y la persistencia tiene una columna `block_status` independiente.

**Decisión**: se modela como dos campos independientes — `status` (`Registered`/`Active`, ciclo de validación documental) y `blockStatus` (`None`/`Blocked` + motivo opcional, moderación, ortogonal). Un `Customer` puede estar `Active` + `Blocked` simultáneamente. `status` pasa a `Active` como efecto lateral de `verifyIdentityDocument()` cuando el documento verificado es del propio `Customer` (no de un `AdditionalDriver`) y `status` seguía en `Registered` — sin endpoint ni evento propio, mismo criterio que `Company.reactivate()`. Diagrama corregido en `docs/model/08-STATE_MACHINES.md §6.5`.

## #39 — `IdentityDocument` usa `Verified`, no `Valid`

**Contexto**: `docs/model/02-AGGREGATES.md §10` y `03-ENTITIES.md §4.7` (y la persistencia) coinciden en `Pending`/`Verified`/`Expired`, pero el diagrama de `08-STATE_MACHINES.md §6.7` (compartido con `VehicleDocument`, no construido todavía) usaba `Valid` — error de rotulado en 1 de 3 fuentes.

**Decisión**: se trata `Verified` como autoritativo (2 de 3 docs + persistencia). Diagrama corregido.

## #40 — `AdditionalDriver` SÍ tiene `version` propio — excepción real y deliberada

**Contexto**: `docs/persistence/04-COLUMNAS-CONCEPTUALES.md §6` confirma `additional_drivers | ... | version`, a diferencia de `identity_documents` (append-only, sin `version`).

**Decisión**: se implementa tal cual documentado — excepción real y deliberada a la regla general de "`version` solo en Aggregate Roots", no un error.

## #41 — Propietario polimórfico de `identity_documents`: 2 columnas FK + `CHECK`, no `owner_type`/`owner_id`

**Contexto**: `docs/persistence/03-RELACIONES.md §5` ya evaluó y descartó la alternativa genérica `owner_type`/`owner_id` para preservar integridad referencial real dentro del mismo schema.

**Decisión**: `customer_id`/`additional_driver_id`, ambas nullable, mutuamente excluyentes vía un `CHECK` agregado a mano en la migración 1 (`identity_documents_owner_exclusive_check`) — mismo procedimiento ya usado para `roles_permissions_not_empty`. Probado con un spec de integración dedicado, sin precedente en este codebase (`identity-document-owner-check.integration.spec.ts`), directo contra Postgres real.

## #42 — `FILE_EXISTS_PORT` no se construye — decisión ya tomada, honrada

**Contexto**: `libs/platform/files/infrastructure/src/files.module.ts` ya documentaba que "ningún consumidor síncrono existe todavía (Vehicles/Customers/Invoices reciben un `fileId` por HTTP, no por DI)".

**Decisión**: `uploadIdentityDocument` confía en el `fileId` recibido sin verificarlo contra Files — gap aceptado y ya documentado antes de esta tanda, no revertido.

## #43 — `TenantModuleEnabledGuard`/`@RequiresProductModule()`: primer consumidor real

**Contexto**: el guard se construyó en la tanda de Settings pero ninguna ruta de Fase 0 lo usaba (mecanismo opt-in).

**Decisión**: `@RequiresProductModule('Rental')` a nivel de clase en `CustomersController` — primer ejercicio real del mecanismo. Confirmado con un e2e dedicado que primero desactiva `Rental` (los defaults de `CompanySettings` ya lo traen habilitado) y comprueba el `403 PRODUCT_MODULE_NOT_ENABLED` antes de reactivarlo.

## #44 — `AGGREGATE_TYPE_TO_SCHEMA`: `Customer` agregado proactivamente

**Contexto**: mismo mapa que ya causó bugs reales dos veces (#26 `File`, #35 `CompanySettings`) — un módulo nuevo que publica eventos y no se agrega aquí falla recién en el primer intento real de publicar.

**Decisión**: `Customer: 'rental'` se agrega antes de correr cualquier smoke test esta vez, no después de que fallara.

## #45 — Corrección de INV-P03: `apps/api` eximido de la regla `scope:platform` no depende de `scope:product-rental`

**Contexto**: al componer `CustomersModule` en `AppModule`, `nx lint` falló con `"A project tagged with 'scope:platform' can not depend on libs tagged with 'scope:product-rental'"`. La regla en `tooling/eslint/boundaries.mjs` era un único `{ sourceTag: 'scope:platform', notDependOnLibsWithTags: ['scope:product-rental'] }`, que atrapaba también a `apps/api` (el único host NestJS, tageado `scope:platform` + `type:feature`) — pese a que `docs/technical/02-PROYECTOS.md` línea 9 ya documenta a `apps/api` como el composition root que "compone todos los módulos de `libs/platform` y `libs/products/rental`". `docs/technical/01-MONOREPO.md §5` describe INV-P03 como "la ley estructural más importante de toda la Plataforma... sin excepción", así que se flaggeó explícitamente al usuario en lugar de resolverlo en silencio.

**Decisión** (confirmada con el usuario): se exime a `apps/api` de la regla, preservando la restricción completa para toda librería de negocio real de `scope:platform`. Implementado con el `ComboSourceTagConstraint`/`allSourceTags` de Nx (semántica AND, confirmada leyendo `node_modules/@nx/eslint-plugin/dist/src/utils/runtime-lint-utils.d.ts` en vez de asumir el schema) — 3 reglas `{ allSourceTags: ['scope:platform', 'type:X'], notDependOnLibsWithTags: ['scope:product-rental'] }` para `X = domain/application/infrastructure`. `apps/api` solo lleva `type:feature`, así que ninguna de las 3 combinaciones lo atrapa; toda librería real de negocio de `scope:platform` sigue restringida (siempre lleva uno de esos 3 `type:*`).

## #46 — Bug real: la `version` del aggregate root de `Customer` no se bumpeaba en mutaciones que solo tocaban entidades internas

**Contexto**: el primer smoke test manual con servidor real (`POST /customers/:id/identity-documents` sobre un `Customer` recién creado) devolvió `409 CONCURRENT_MODIFICATION` sin que hubiera ninguna concurrencia real. `PrismaCustomerRepository.save()` hace `updateMany({ where: { version: customer.version - 1 } })` asumiendo que TODA mutación del aggregate incrementa `version`, pero `uploadIdentityDocument`/`verifyIdentityDocument`/`registerAdditionalDriver`/`validateAdditionalDriverLicense`/`revokeAdditionalDriver` nunca lo hacían — solo tocaban entidades internas dirty-tracked, nunca `props` del root.

**Decisión**: las 5 mutaciones ahora bumpean `version`/`updatedAt` del root en todo cambio real, alineado con `updateDetails()`/`block()`/`unblock()`. Aprovechado el mismo cambio para alinear la idempotencia de `verifyIdentityDocument`/`validateAdditionalDriverLicense`/`revokeAdditionalDriver`: una llamada repetida sobre un estado ya alcanzado no vuelve a marcar dirty, no reemite el evento de dominio, ni bumpea `version` — mismo criterio de no-op silencioso que `block()`/`unblock()`. Confirma un patrón a vigilar en cualquier aggregate futuro con entidades internas: **toda** mutación del árbol, incluidas las que solo tocan hijos, debe bumpear la `version` del root, no solo las que cambian sus propios campos.

## #47 — Vehicles: `license_plate`/`vin` únicos por `company_id` — cierra el punto abierto #6

**Contexto**: `#6` dejaba deliberadamente sin decidir la unicidad de `vehicles.license_plate`, a la espera del equipo de dominio. Al construir Vehicles (Fase 1 item 2) había que tomar una decisión real para poder escribir el schema.

**Decisión**: único por `(company_id, license_plate)` y `(company_id, vin)` — mismo shape que cada otra clave natural del dominio (`Customer.taxIdOrDocumentId`, `VehicleCategory.categoryName`, `Company.taxId`). No intenta resolver el caso de placa reasignada tras baja de flota (`vehicles` no tiene soft delete, "baja de flota fuera de alcance de v1.0" ya documentado en `09-TRAZABILIDAD.md`) — si ese caso se vuelve real, es una migración futura, no algo que este schema deba prever hoy.

## #48 — `Money` agregado a `shared-kernel`; `DateRange` deliberadamente diferido

**Contexto**: ni `Money` ni `DateRange` existían en `shared-kernel` pese a estar catalogados en `docs/model/04-VALUE_OBJECTS.md §1.1/§1.2` como VOs "verdaderamente universales" — mismo tipo de gap que `PhoneNumber` antes de Customers.

**Decisión**: se agrega `Money` (consumidor real: `Rate.amount`). `DateRange` NO se agrega — su contrato fija `endDate` estrictamente no-nulable, pero `Rate.validTo` debe admitir `null` (vigencia abierta). `Rate.validFrom`/`validTo` se modelan como `Date`/`Date | null` planos, con un `overlaps()` propio en la entidad `Rate` — no promovido a `shared-kernel` porque no hay otro consumidor real esta tanda (`MaintenanceRecord.scheduledStart`/`scheduledEnd` no necesita semántica de solapamiento, y `Reservation`/`AvailabilitySlot`, los consumidores naturales de `DateRange`, no están construidos). Se difiere a quien primero lo necesite de verdad.

## #49 — `Vehicle.branchId`: se consulta `BRANCH_LOOKUP_PORT`, resolviendo una contradicción real entre dos docs

**Contexto**: `docs/model/09-DEPENDENCIES.md §2` solo lista `BranchStatusPort` como consumido por `Reservation`; el propio comentario de `libs/platform/branches/application/src/ports/branch-lookup.port.ts` decía "sin consumidor real todavía". Pero `docs/persistence/03-RELACIONES.md` dice explícitamente, para `vehicles.branch_id`: _"la integridad se valida en `application/` al crear el `Vehicle` (el caso de uso consulta `BranchStatusPort`)"_.

**Decisión**: se sigue la instrucción más específica y prescriptiva (`03-RELACIONES.md`) — `RegisterVehicleHandler` consulta `BRANCH_LOOKUP_PORT` (primer consumidor real del puerto) y valida solo existencia (`null` → `VehicleBranchNotFoundError`, 404), no el status `Closed` — esa regla (INV-112) es específica de `Reservation.checkOut()/checkIn()`, no de alta de vehículo.

## #50 — Gap-filling: `VehicleDocumentType`, `RateUnit`, `DamageSeverity`

**Contexto**: ninguno de los tres tiene catálogo cerrado documentado. RN-27 dice explícitamente que el catálogo real de tipos de documento vehicular es "dependiente de país"; "día/semana" para `Rate.unit` solo aparece en prosa (`03-ENTITIES.md §4.2`); la severidad de `reportDamage()` no está enumerada en ningún doc.

**Decisión**: `VehicleDocumentType = PropertyCard | Insurance | CirculationPermit` (los 3 ejemplos que el propio `02-AGGREGATES.md §8` da: tarjeta de propiedad, seguro, permiso de circulación) — mismo criterio que `Customer.DocumentType`. `RateUnit = Day | Week`. `DamageSeverity = Minor | Severe` (`Minor → Maintenance`, `Severe → OutOfService`).

## #51 — INV-007 interpretado como "al menos un documento `Verified`, de cualquier tipo"

**Contexto**: RN-27 exige documentación vigente para `enable()`, pero el conjunto de tipos obligatorios es "dependiente de país" y no hay ninguna política de `CompanySettings` que lo respalde esta tanda (`MaintenanceThresholdPolicy` y sus hermanas siguen deliberadamente diferidas desde la tanda de Settings).

**Decisión**: `Vehicle.enable()` exige al menos un `VehicleDocument` `Verified`, de cualquier tipo — no "los 3 tipos del catálogo". Exigir el conjunto completo inventaría una regla más estricta sin base documental; "al menos uno" replica el criterio ya usado en `Customer.isEligibleForConfirmation()`.

## #52 — `MaintenanceRecord.damageReportId` omitido por completo

**Contexto**: `docs/persistence/03-RELACIONES.md` documenta un FK opcional `maintenance_records.damage_report_id → damage_reports.id` (cross-aggregate, mismo BC) para mantenimiento correctivo originado en un daño detectado durante una `Reservation`. `damage_reports` no existe — es parte de `Reservation`, Fase 1 item 4, no construida.

**Decisión**: se omite la columna por completo esta tanda (ni siquiera nullable sin FK) — agregarla luego es un Expand limpio (`docs/persistence/07-MIGRACIONES.md §2`) cuando `Reservation`/`DamageReport` exista. `Vehicle.reportDamage()` transiciona el status pero no crea un `MaintenanceRecord` por sí mismo — según la máquina de estados, solo `scheduleMaintenance()` lo hace, como paso separado.

## #53 — `AGGREGATE_TYPE_TO_SCHEMA`: `Vehicle`/`VehicleCategory` agregados proactivamente

**Contexto**: mismo mapa que ya causó bugs reales tres veces (`#26` `File`, `#35` `CompanySettings`, y el propio `Customer` se agregó proactivamente en la tanda anterior).

**Decisión**: `Vehicle: 'rental'` y `VehicleCategory: 'rental'` se agregan antes de correr cualquier smoke test.

## #54 — Bug real: `error.meta.target` de Prisma no distingue `license_plate`/`vin` en la arquitectura de driver adapters (Prisma 7.x)

**Contexto**: el smoke manual con servidor real (segundo `POST /vehicles` con la misma placa) devolvió `500` en vez de `409 DUPLICATE_VEHICLE_LICENSE_PLATE`. `PrismaVehicleRepository.mapUniqueConstraintViolation()` asumía que `error.meta.target` llegaba como array de nombres de columna (comportamiento del query engine Rust clásico de Prisma) — en la versión de este proyecto (7.9.1, arquitectura de driver adapters) `target` llega como el string literal `"(not available)"`, nunca poblado. El nombre real del constraint solo está en `error.meta.driverAdapterError.cause.originalMessage` (confirmado inspeccionando el log real del servidor, no asumido de la documentación de Prisma) — el mismo lugar de donde `isRateOverlapViolation()` ya leía el nombre de la exclusion constraint GiST para `RateOverlapError`.

**Decisión**: se agrega `extractDriverErrorMessage()` para leer ese campo anidado con fallback a `error.message`, y se distingue `license_plate`/`vin` por el nombre del constraint (`vehicles_company_id_license_plate_key`/`vehicles_company_id_vin_key`) en vez de por columnas. Patrón a vigilar en cualquier repositorio futuro que necesite distinguir entre múltiples constraints `UNIQUE` sobre la misma tabla: `error.meta.target` no es confiable en esta versión de Prisma, usar el mensaje crudo del driver.

## #55 — Calendar: `DateRange` finalmente implementado, primer consumidor real

**Contexto**: catalogado en `docs/model/04-VALUE_OBJECTS.md §1.2` como VO "verdaderamente universal" desde el principio, pero diferido en la tanda de Vehicles porque `Rate.validTo` necesitaba vigencia abierta (nulable), incompatible con el contrato de `endDate` estrictamente no-nulable de este VO (`#48`).

**Decisión**: `AvailabilitySlot.dateRange` (Calendar, Fase 1 item 3) sí encaja en el contrato original — se implementa en `shared-kernel` tal como estaba especificado, sin ninguna adaptación. Cierra la nota "Estado: NO implementado" agregada a `04-VALUE_OBJECTS.md §1.2` en la tanda de Vehicles.

## #56 — Bug real: `save()` lanzaba `409 CONCURRENT_MODIFICATION` espurio en mutaciones idempotentes que no cambian nada

**Contexto**: descubierto al escribir `ReleaseSlotHandler` para Calendar. `PrismaXxxRepository.save()` para un aggregate existente siempre hace `updateMany({ where: { version: aggregate.version - 1 } })`, asumiendo que toda llamada a `save()` sigue a una mutación que bumpeó `version`. Pero varios métodos de dominio son idempotentes por diseño (no bumpean `version` en una segunda llamada sobre un estado ya alcanzado: `Customer.block()`/`unblock()`, `IdentityDocument.verify()`, `AdditionalDriver.validateLicense()`/`revoke()`, `Vehicle.verifyDocument()`, `AvailabilitySlot.release()`). En ese caso `aggregate.version` sigue igual al valor ya guardado en la base, así que el `updateMany` busca `version - 1` (que no existe) y devuelve 0 filas, lanzando un `ConcurrentModificationError` sin que haya habido ninguna concurrencia real. Nunca se detectó antes porque ningún smoke test ni e2e llamó la misma acción idempotente dos veces seguidas contra Postgres real — los tests de dominio solo verificaban la idempotencia a nivel de entidad (`version` no cambia), sin llegar a ejercitar `save()` después.

**Decisión**: se corrige en los 6 handlers ya afectados (`VerifyIdentityDocumentHandler`, `ValidateAdditionalDriverLicenseHandler`, `RevokeAdditionalDriverHandler`, `BlockCustomerHandler`, `UnblockCustomerHandler` en Customers; `VerifyVehicleDocumentHandler` en Vehicles) capturando la versión antes de la mutación y saltando la persistencia por completo si no cambió. `ReleaseSlotHandler` (Calendar) se escribe con este patrón desde el inicio. Confirmado contra Postgres real (bloquear un `Customer` ya `Blocked` dos veces seguidas vía HTTP, antes devolvía `409`, ahora `201` sin efecto). Patrón a aplicar en todo handler futuro cuya mutación de dominio tenga una rama idempotente de no-op.

## #57 — `AGGREGATE_TYPE_TO_SCHEMA`: `AvailabilitySlot` agregado proactivamente

**Contexto**: mismo mapa que ya causó bugs reales cuatro veces (`#26` `File`, `#35` `CompanySettings`, y `Customer`/`Vehicle` agregados proactivamente en tandas anteriores).

**Decisión**: `AvailabilitySlot: 'scheduling'` se agrega antes de correr cualquier smoke test.

## #58 — Calendar no tiene ningún event listener — decisión de alcance, no un gap

**Contexto**: `VehicleStatusChanged.v1`/`MaintenanceScheduled.v1` (Vehicle) están documentados como traducibles a un `Blackout` en Scheduling. Podría parecer que esta tanda debía agregar un listener dentro de `platform/calendar` que escuche esos eventos.

**Decisión**: no se agrega ningún listener — `docs/model/01-BOUNDED_CONTEXTS.md §4.2` fija explícitamente que la traducción vive en `AvailabilityService` (`application/` del futuro módulo `reservations`, `scope:product-rental`), nunca dentro de Scheduling. Agregar el listener aquí violaría INV-P03 en la dirección exactamente opuesta a la que Customers/Vehicles ya corrigieron (`#45`): `platform/calendar` importando conocimiento del shape de eventos de `Vehicle` (`scope:product-rental`). Este trabajo queda explícitamente pendiente para la futura tanda de Reservations.

## #59 — `CompanySettings` extendido con las 5 políticas que `Reservation` necesita

**Contexto**: `docs/model/02-AGGREGATES.md §6` ya lista las 9 políticas de `CompanySettings`, pero la Fase 0/Settings solo construyó 2 (`EnabledProductModules`, `PaymentMethodsEnabled`) — decisión #30 declaró explícitamente que las 7 restantes "se construyen cuando Rental Operations les dé forma real". `docs/model/09-DEPENDENCIES.md §2` lista textualmente 5 políticas que `Reservation` consume vía el puerto: `CancellationPolicy` (RN-26), `LateReturnPolicy` (RN-15/RN-16), `DepositPolicy` (RN-21), `DraftExpirationPolicy` (RN-05), `MinimumBookingLeadTime` (RN-06).

**Decisión**: se agregan las 5 al aggregate `CompanySettings` y al puerto existente `SETTINGS_LOOKUP_PORT`/`SettingsLookupPort` (no se crea un `CompanySettingsPort` nuevo — el nombre en `09-DEPENDENCIES.md` es conceptual, el puerto real ya construido en Fase 0 es este). `CancellationPolicy`/`LateReturnPolicy`/`DepositPolicy` se modelan porcentuales (tramos de antelación + porcentaje de penalidad; tolerancia de gracia + porcentaje por hora; aplica/no + porcentaje del total), nunca `Money` fijo — una política a nivel de `Company` no puede fijar un monto en una moneda concreta, el monto real se resuelve contra el `PriceBreakdown` de cada `Reservation`. `DepositPolicy` se agrega por completitud del contrato documentado pero **sin consumidor real** esta tanda (`SecurityDeposit` es Commerce/Fase 2) — mismo patrón "forward-looking sin consumidor" ya usado para los puertos de Customers/Vehicles/Calendar antes de que `Reservation` existiera. Defaults neutrales documentados en cada VO (`*.default()`): sin penalidad de cancelación en ningún tramo, 30 min de gracia + 10%/hora de exceso, sin depósito, 24h de expiración de `Draft`, sin antelación mínima.

## #60 — Extensión de `VehicleStatusPort`/`CustomerLookupPort` — cierran su propósito forward-looking

**Contexto**: `checkOut()` necesita INV-112 (¿la `Branch` del `Vehicle` está `Active`?) pero `Reservation` no contiene `branchId` (`docs/model/02-AGGREGATES.md §11`: "solo `CustomerId`/`VehicleId`"). `create()`/`confirm()` necesitan resolver la `Rate` vigente de un `Vehicle` (`VEHICLE_CATEGORY_LOOKUP_PORT.getCurrentRate` toma `categoryId`, no `vehicleId`). `checkOut()` necesita INV-105 (¿cada `AdditionalDriver` autorizado está `Validated`?).

**Decisión**: `VehicleStatusPort` gana `getBranchId(vehicleId)` y `getCategoryId(vehicleId)`; `CustomerLookupPort` gana `areAdditionalDriversValidated(driverIds)`. Los 3 métodos son consumidos de inmediato — a diferencia de `DepositPolicy` (#59), estos cierran por completo el propósito "forward-looking sin consumidor" con el que ambos puertos fueron publicados en las tandas de Vehicles/Customers.

## #61 — Orden de ocupación/liberación del `AvailabilitySlot`: nunca "ambos libres"

**Contexto**: `docs/domain/07-EXCEPCIONES.md §7` (Vehicle Swap) exige explícitamente "nunca queda un estado intermedio donde ambos aparecen ocupados o ambos libres". El mismo riesgo aplica a `reschedule()`/`approveExtension()` (mueven la ventana ocupada del _mismo_ `vehicleId`) y a `swapVehicle()` (ocupa un `vehicleId` _distinto_).

**Decisión**: toda operación que mueve ocupación siempre ocupa el destino antes de liberar el origen — "ambos ocupados" transitorio es aceptable, "ambos libres" nunca. Para `swapVehicle()` (resourceId distinto), `AvailabilityService.reserve(nuevo)` + `release(viejo)` alcanza sin ambigüedad, porque cada `vehicleId` tiene a lo sumo un slot `Active` propio. Para `reschedule()`/`approveExtension()` (mismo `vehicleId`), ocupar el nuevo rango _antes_ de liberar el viejo crearía momentáneamente **dos** `AvailabilitySlot` `Active` para el mismo `resourceId` — ambiguo para cualquier búsqueda "el slot activo de este vehicle". Se resuelve con `AvailabilityService.moveOccupancy()`: captura el id del slot viejo _antes_ de ocupar el nuevo (momento en que la búsqueda todavía es inequívoca), ocupa el nuevo, y recién entonces libera el viejo por id explícito — nunca por una segunda búsqueda "el slot activo". `CalendarPort` gana `findActiveSlotId(resourceType, resourceId)` para soportar esto (`Reservation` no persiste el `AvailabilitySlot`, "no se persiste ni cachea", `docs/model/02-AGGREGATES.md §11`).

## #62 — `confirm()`: transacción separada del `AvailabilitySlot`, nunca distribuida — confirmado textualmente, no inventado

**Contexto**: `docs/model/02-AGGREGATES.md §11` ("Transacciones") y `09-DEPENDENCIES.md §2` (nota de lectura) fijan textualmente que la ocupación/liberación del `AvailabilitySlot` correlacionado "ocurre en una transacción separada... pero como una llamada síncrona al puerto de Scheduling — no como una transacción distribuida (INV-P04)". Esto coincide exactamente con cómo `CalendarPort`/`OccupySlotHandler`/`ReleaseSlotHandler` ya estaban construidos desde Calendar (cada uno abre su propio `unitOfWork.run()`) — no fue necesario inventar ningún mecanismo nuevo de transacción compartida.

**Decisión operativa** (esta sí de implementación, no textual): `ConfirmReservationHandler` ocupa el slot **antes** de persistir `Reservation → Confirmed`. Si `AvailabilityService.isAvailable()` (pre-check) devuelve `false`, o si `CalendarPort.occupy()` pierde la carrera contra la exclusion constraint (`AvailabilitySlotOverlapError`, traducido a `ReservationOverlapError` — ver #63), se publica `ReservationRejectedByAvailability.v1` en su propia transacción (el agregado permanece `Draft`, no existe un estado "Rejected" en la máquina de estados) — `OutboxWriter.publish()` no exige que la fila del agregado cambie en el mismo `tx`, así que esto no requiere ninguna mutación artificial de `Reservation`. Si el `occupy()` tiene éxito pero la persistencia subsiguiente de `Reservation` falla (p. ej. `ConcurrentModificationError`), se compensa liberando el slot recién ocupado (best-effort — un fallo de la compensación misma es un gap de reconciliación conocido, no bloqueante para Fase 1).

## #63 — Traducción de errores cross-módulo por `.name`, no `instanceof` — restricción real de `tooling/eslint/boundaries.mjs`

**Contexto**: `AvailabilityService.reserve()` necesita distinguir `AvailabilitySlotOverlapError` (Scheduling) de cualquier otro error para decidir si publica `ReservationRejectedByAvailability.v1`. El intento inicial de `catch (error) { if (error instanceof AvailabilitySlotOverlapError) ... }` requiere `import { AvailabilitySlotOverlapError } from '@platform/calendar/domain'` dentro de `reservations/application` — bloqueado por el linter: la regla de `module:reservations` solo permite depender de `type:application`/`type:infrastructure` de otros módulos, nunca de su `type:domain`, sin importar el `scope`.

**Decisión**: se distingue por `error.name === 'AvailabilitySlotOverlapError'` (`DomainError` fija `this.name = new.target.name` en su constructor, confirmado en `libs/platform/shared-kernel/src/errors/domain-error.ts`) — patrón de traducción de error legítimo para una Anti-Corruption Layer que no puede tipar la excepción de origen. Mismo criterio aplicado a `resolve-cancellation-penalty.ts` (reimplementación local de `CancellationPolicy.penaltyPercentageFor()`, ya que `reservations/application` tampoco puede importar el VO de `platform-settings-domain`) y a `PricingService.calculateFuelDifferenceCharge()` (ver #66).

## #64 — `checkIn()` también libera el `AvailabilitySlot` — decisión propia, no textual

**Contexto**: ningún documento dice explícitamente que `checkIn()` deba liberar el slot — solo `cancel()`/`markNoShow()` (desde `Confirmed`) lo hacen textualmente en la tabla de transiciones.

**Decisión**: `checkIn()` también libera. Razonamiento: el propósito de `AvailabilitySlot` es prevenir doble-booking durante la ventana reservada; `AvailabilitySlot` no tiene ningún mecanismo de expiración automática (sin job), así que si el cliente devuelve antes de `endDate` y no se libera explícitamente, el `Vehicle` queda bloqueado hasta la fecha original aunque ya esté físicamente disponible. Documentado explícitamente para que un futuro desarrollador no lo interprete como un olvido.

## #65 — Gap-fill: `PriceAdjustmentKind` gana un 5to valor, `CancellationPenalty`

**Contexto**: `docs/model/02-AGGREGATES.md §11` documenta el catálogo de `PriceAdjustment.kind` como `Extension | LateReturnPenalty | DamagePenalty | FuelDifference` (4 valores). Pero `docs/model/08-STATE_MACHINES.md §1.1` dice explícitamente que `cancel()` (RN-26) y `markNoShow()` (RN-19, "misma política de cancelación tardía") "pueden generar `PriceAdjustment` de penalidad" — ningún valor documentado encaja: `LateReturnPenalty` es semánticamente distinto (se genera en `checkIn()`, por una devolución tardía de un alquiler _ya entregado_, no por una cancelación _antes_ de la entrega).

**Decisión**: se agrega `CancellationPenalty` al enum (dominio y Prisma), mismo criterio de gap-fill ya usado para `DamageSeverity`/`VehicleDocumentType`/`RateUnit` en Vehicles — un valor nuevo en un catálogo ya documentado, nunca una reinterpretación de una regla de negocio.

## #66 — `RN-18` (diferencia de combustible): sin `FuelPolicy` en el catálogo de `CompanySettings`, modelado proporcional

**Contexto**: `docs/model/05-DOMAIN_SERVICES.md §2` menciona una "`FuelPolicy`-equivalente desde `CompanySettings`" como entrada de `PricingService`, pero el catálogo real de 9 políticas de `CompanySettings` (`docs/model/02-AGGREGATES.md §6`) no incluye ninguna política de combustible — inconsistencia entre dos documentos, no un gap silencioso.

**Decisión**: `PricingService.calculateFuelDifferenceCharge()` cobra proporcional al déficit porcentual de combustible sobre un monto de referencia (la tarifa diaria vigente) — un tanque completo faltante cuesta el equivalente a esa tarifa diaria completa. Pragmático, sin política configurable, documentado como gap-fill explícito para que un futuro desarrollador no asuma que existe una `FuelPolicy` real en `CompanySettings`.

## #67 — Cierre de la decisión #52: `maintenance_records.damage_report_id`

**Contexto**: la decisión #52 (Vehicles) omitió deliberadamente la columna `damage_report_id` de `maintenance_records` porque `damage_reports` no existía todavía.

**Decisión**: se agrega `damage_report_id` (nullable, FK `RESTRICT` hacia `rental.damage_reports.id`) ahora que la tabla existe — Expand limpio, sin ningún comando que la use todavía (`Vehicle.reportDamage()` transiciona el status pero no crea un `MaintenanceRecord` por sí mismo, solo `scheduleMaintenance()` lo hace, paso separado, sin cambios en esta tanda).

## #68 — `AGGREGATE_TYPE_TO_SCHEMA`: `Reservation` agregado proactivamente

**Contexto**: mismo mapa que ya causó bugs reales cuatro veces (`#26` `File`, `#35` `CompanySettings`, `Customer`/`Vehicle`, `#57` `AvailabilitySlot`).

**Decisión**: `Reservation: 'rental'` se agrega antes de correr cualquier smoke test. Los hijos (`Inspection`/`DamageReport`/`PriceAdjustment`) no publican eventos propios — van embebidos en los eventos del root, mismo criterio que `VehicleDocument`/`MaintenanceRecord`.

## #69 — `close()` sin listener real esta tanda — decisión de alcance, no un gap

**Contexto**: `close()` reacciona conceptualmente a `InvoiceIssued.v1` (INV-108/RN-22), pero `Invoice`/Commerce es Fase 2 — ese evento nunca se publica todavía.

**Decisión**: se implementa el método de dominio `Reservation.close()` y `CloseReservationHandler` completos (invocables, con tests) — la máquina de estados completa se construye esta tanda, no solo el camino Draft→Confirmed→CheckedOut→CheckedIn que exige el exit-criterion literal. Pero **no se registra ningún listener NestJS** suscrito a `InvoiceIssued.v1` — no hay nada que lo dispare todavía. Mismo criterio ya usado en Calendar (#58: ningún listener sin consumidor real). Consecuencia directa: el smoke test/e2e de esta tanda llega hasta `CheckedIn`, no hasta `Closed`.

## #70 — Bug real: `confirm()` sobre una `Reservation` ya `Confirmed` devolvía `409 VEHICLE_NOT_AVAILABLE` en vez de `409 INVALID_STATE_TRANSITION`

**Contexto**: encontrado con el mismo smoke test manual contra servidor real ya usado en toda la sesión (no un test automatizado). `ConfirmReservationHandler` corría el pre-check `AvailabilityService.isAvailable()` _antes_ de cualquier guarda de estado — para una `Reservation` ya `Confirmed`, el propio slot que ella misma ocupó hace que `isAvailable()` devuelva `false`, y el handler lo interpretaba como "el vehicle no está disponible" en vez de "esta reservation ya no está en `Draft`". Técnicamente el rechazo con 409 era correcto, pero el código/mensaje era engañoso para el caller — no hay nada raro con el `Vehicle`.

**Decisión**: se agrega una guarda de estado temprana (`reservation.status !== 'Draft'` → `ReservationInvalidStateTransitionError`) al inicio del handler, antes de cualquier I/O de disponibilidad. Patrón a vigilar en cualquier handler futuro que combine una guarda de estado del propio agregado con un pre-check de un recurso externo cuyo resultado _depende_ del propio estado del agregado que se está guardando — la guarda de estado propia siempre va primero.

## #71 — `SettingsLookupPort` gana `getPaymentMethodsEnabled` — segundo consumidor real de `PaymentMethodsEnabled`

**Contexto**: `docs/model/04-VALUE_OBJECTS.md §6` fija que `PaymentMethod` "debe pertenecer al `PaymentMethodsEnabled` vigente de la `Company`" — invariante de negocio, no solo de forma. El puerto ya expone `getEnabledProductModules` (concepto distinto: módulos de producto, no métodos de pago), pero ningún método existente resuelve la lista de métodos habilitados de una `Company` para consumo cross-módulo.

**Decisión**: se agrega `getPaymentMethodsEnabled(companyId): Promise<string[] | null>` al puerto ya existente (no un puerto nuevo, mismo criterio que `getDepositPolicy` en `#59`). `RequestPaymentHandler` lo consulta antes de crear el `Payment`: si la lista no es `null` y el método solicitado no está incluido, se rechaza con `InvalidPaymentMethodError` — mismo error que ya usa la validación de catálogo cerrado (`PaymentMethod.from()`), reutilizado porque el catálogo de errores (`docs/contracts/07-ERROR-CATALOG.md`) no reserva un código distinto para "método fuera de lo habilitado por la Company" frente a "método fuera del catálogo cerrado de 4 valores" — ambos son, semánticamente, "este valor de `PaymentMethod` no es válido en este contexto".

## #72 — Gap de catálogo: no existe `SecurityDepositFullyRetained.v1` — se reutiliza `SecurityDepositPartiallyRetained.v1`

**Contexto**: `docs/model/08-STATE_MACHINES.md §6.9` documenta `RetainedFully` como un estado terminal propio, distinto de `RetainedPartially`. Pero el catálogo de eventos de dominio (`docs/model/06-DOMAIN_EVENTS.md §7`) solo lista `SecurityDepositHeld.v1`, `SecurityDepositReleased.v1` y `SecurityDepositPartiallyRetained.v1` — tres eventos para cuatro estados, sin ningún `SecurityDepositFullyRetained.v1`.

**Decisión**: `SecurityDeposit.retain()` emite `SecurityDepositPartiallyRetained.v1` en ambos casos (retención parcial y total) — el payload `retainedAmount` ya distingue cuál ocurrió, comparándolo contra `amount` (idéntico ⇒ `RetainedFully`; menor ⇒ `RetainedPartially`). Se prefiere reutilizar el evento documentado a inventar uno nuevo no reservado en el catálogo — mismo criterio de "gap-fill sin reinterpretar" ya aplicado a `CancellationPenalty` (`#65`).

## #73 — `HoldSecurityDepositHandler` nunca llama al gateway — desviación deliberada del plan original

**Contexto**: el plan de esta tanda previó que `hold()`, al reaccionar a `ReservationConfirmed.v1`, llamara `PaymentGatewayPort.authorize()` para obtener un `GatewayHoldReference` cuando el método de pago implicara preautorización de tarjeta. Al implementar, se confirmó que `Reservation` no modela ningún `PaymentMethod` elegido (`docs/model/02-AGGREGATES.md §11`) — ni `ReservationConfirmed.v1` ni ningún otro evento de Reservations transporta ese dato.

**Decisión**: `SecurityDepositHoldListener`/`HoldSecurityDepositHandler` solo crean el registro contable del `SecurityDeposit` (`Held`, sin `gatewayHoldReference`) — nunca preautorizan una tarjeta de forma automática. Si una preautorización real llega a necesitarse, se modela como un `Payment` independiente (`targetType: 'SecurityDeposit'`, `targetId: deposit.id`) a través del flujo manual ya existente (`POST /payments` → `authorize()`) — evita inventar un mecanismo de "método de pago de la reserva" no documentado en ningún lado. `gatewayHoldReference` sigue existiendo en el aggregate y en el schema para ese caso futuro, pero la tanda actual nunca lo puebla desde el listener automático.

## #74 — `PaymentGatewayDeclinedError`/`PaymentGatewayUnavailableError` viven en `application/`, no en `domain/`

**Contexto**: todo el resto de la sesión coloca los `DomainError` de un módulo en su `domain/` (p. ej. `ReservationOverlapError`, `PaymentInvalidStateTransitionError`). Pero estos dos representan desenlaces de I/O de la pasarela de pago (rechazo de negocio vs. falla técnica/de conectividad) — nunca una regla del aggregate `Payment`, que ni siquiera conoce que existe un "gateway".

**Decisión**: se colocan en `payments/application` (`errors/payment-gateway-{declined,unavailable}.error.ts`), extendiendo igual `DomainError` de `shared-kernel` (que no exige vivir en `domain/` — `ConcurrentModificationError` ya sienta ese precedente, viviendo directamente en `shared-kernel`). Los adaptadores concretos de `integration-providers/infrastructure` los lanzan directamente: `type:infrastructure` puede depender de `type:application` de cualquier módulo (`tooling/eslint/boundaries.mjs`, eje `module`), pero nunca de `type:domain` de otro módulo — así que solo `application/` era una ubicación estructuralmente válida para una clase que ambas capas necesitan compartir. `payments-domain-error.registry.ts` (infraestructura) las registra igual que a cualquier otro `DomainError`, sin distinción especial.

## #75 — Puertos `STRIPE_WEBHOOK_TRANSLATOR_PORT`/`MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT` — los adaptadores concretos nunca se exportan directo

**Contexto**: los webhook controllers (`StripeWebhookController`/`MercadoPagoWebhookController`, `payments/infrastructure`) necesitan invocar `verifyAndTranslateWebhook()`, un método que no forma parte de `PaymentGatewayPort` (ese puerto solo tiene los 4 métodos de `docs/11-INTEGRACIONES.md §6`). La primera versión exportaba las clases concretas (`StripePaymentGatewayAdapter`/`MercadoPagoPaymentGatewayAdapter`) directo desde `IntegrationProvidersModule` para que los controllers las inyectaran por tipo.

**Decisión**: se revierte a dos puertos nuevos y explícitos, cada uno con un único método `verifyAndTranslateWebhook()`, implementados por el adaptador concreto correspondiente y expuestos con `{ provide: STRIPE_WEBHOOK_TRANSLATOR_PORT, useExisting: StripePaymentGatewayAdapter }`. Los webhook controllers inyectan el puerto, nunca la clase — "solo el módulo es público" (`docs/technical/09-CODING-STANDARDS.md §2`), mismo criterio que ya impedía exportar `S3StorageProviderAdapter` directo. Consecuencia práctica encontrada más tarde (`#76`/`#78`): como `useExisting` obliga a Nest a instanciar igual la clase concreta (no hay "binding perezoso" per-provider), cualquier adaptador con una SDK que valide credenciales en su constructor debe tolerar credenciales vacías sin lanzar.

## #76 — `companyId` viaja en la metadata de la pasarela — resolver el tenant de un webhook sin `RequestContext`

**Contexto**: `POST /webhooks/v1/{stripe,mercadopago}` es `@Public()`, fuera de `/api/v1` — nunca pasa por `TenantContextGuard`, así que `RequestContext`/CLS nunca se puebla. Pero `HandleGatewayWebhookHandler` necesita un `companyId` explícito para que `ReadTransaction.run()`/`UnitOfWork.run()` puedan fijar `SET LOCAL app.current_company_id` (RLS fail-closed, `docs/persistence/06-RLS.md §6` — sin él, la notificación de un webhook real nunca vería ninguna fila.

**Decisión**: `AuthorizePaymentHandler` (el único punto donde el dominio conoce el `companyId` del `Payment` en el momento en que se abre un `PaymentIntent`/`Payment` de MercadoPago) adjunta `companyId` como metadata de la pasarela (`Stripe.PaymentIntent.metadata.companyId`, `MercadoPago.Payment.metadata.companyId`). `verifyAndTranslateWebhook()` lo extrae de ahí — si falta (nunca debería, salvo un `Payment` creado por otra vía), devuelve `null` y el controller responde `200` sin traducir, en vez de fallar. `HandleGatewayWebhookCommand` incluye `companyId` como campo propio (no inferido de `RequestContext`) y `PaymentRepository.findByGatewayReference`/`SecurityDepositRepository.findById`/`findByReservationId` aceptan `companyId` explícito opcional — mismo mecanismo ya usado por `Login`/`RefreshSession` (`ReadTransaction.run(work, companyId?)`, `#11`) y ahora también por los listeners fire-and-forget de `SecurityDeposit` (`EventEmitter2.emit()` nunca garantiza que la continuación async herede el CLS del request original).

## #77 — Alcance de Stripe/MercadoPago: código real y completo, sin verificar contra su API viva

**Contexto**: ninguna credencial real de Stripe/Mercado Pago existe en este entorno de desarrollo. Decisión explícita del usuario (`AskUserQuestion` de esta tanda): construir los 3 adaptadores completos (`fake`/`stripe`/`mercadopago`) en vez de diferir los dos reales a una tanda futura con credenciales disponibles.

**Decisión**: `StripePaymentGatewayAdapter`/`MercadoPagoPaymentGatewayAdapter` implementan los 4 métodos de `PaymentGatewayPort` más su respectivo `*WebhookTranslatorPort` contra las SDKs oficiales (`stripe@22.5.0`, `mercadopago@3.4.0`) — código de producción, no un stub. El adaptador activo se selecciona por `PAYMENT_GATEWAY_PROVIDER` (`fake` por default, `ADR-0010`, nunca hardcodeado) — `fake` es el único ejercido end-to-end en el smoke test/e2e de esta tanda (`FakePaymentGatewayAdapter`, determinístico, sin latencia simulada). Gap documentado explícitamente, mismo criterio que otros gaps de credenciales ya aceptados en la sesión (p. ej. OCR): Stripe/MercadoPago quedan sin verificación contra una API viva hasta que el proyecto disponga de credenciales de prueba reales.

## #78 — Bug real: el adaptador de Stripe tumbaba el boot completo de `apps/api` sin `STRIPE_SECRET_KEY`

**Contexto**: encontrado corriendo el e2e de Payments contra un servidor real (mismo método de todas las tandas de esta sesión). El SDK de Stripe lanza en su propio constructor (`new Stripe(apiKey)`) si `apiKey` es una cadena vacía. `StripePaymentGatewayAdapter` construía el cliente en su propio constructor — y, por `#75`, Nest lo instancia siempre (`useExisting` para `STRIPE_WEBHOOK_TRANSLATOR_PORT` no admite instanciación perezosa por provider), sin importar qué valor tenga `PAYMENT_GATEWAY_PROVIDER`. Resultado: cualquier entorno sin credenciales reales de Stripe (el caso de desarrollo por defecto, `#77`) nunca lograba levantar `apps/api`.

**Decisión**: se difiere la construcción del cliente `Stripe` a un getter perezoso, invocado solo cuando algún método del adaptador se llama de verdad — si en ese momento `STRIPE_SECRET_KEY` sigue vacía, lanza `PaymentGatewayUnavailableError` (un error de negocio esperable, `503`), no una excepción no controlada en el boot. Patrón a vigilar en cualquier adaptador futuro que envuelva una SDK con validación estricta en su constructor y que, por el patrón de `#75` (`useExisting` para un puerto secundario), termine instanciándose siempre independientemente de si está activo.

## Qué NO se registra en este documento

- Decisiones ya tomadas en `docs/`, `docs/ADR/`, `docs/model/` o `docs/technical/` — se heredan, se citan, nunca se repiten aquí como si fueran nuevas.
- Valores de calibración dependientes de datos reales de producción (tamaño de pool, parámetros de `argon2id`, umbrales de rate limiting) — diferidos a Fase 6, mismo criterio ya usado en todo `docs/technical/`.
