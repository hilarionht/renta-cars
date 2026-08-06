# 10 — Decisiones

Registro de las decisiones **nuevas** de esta fase de modelado físico — el equivalente, para `docs/persistence/`, de [docs/ADR/](../ADR/README.md) y de [technical/10-DECISIONES.md](../technical/10-DECISIONES.md). Cada entrada aquí es una decisión de **diseño físico** derivada mecánicamente de una regla de dominio o de arquitectura ya fijada, nunca una reinterpretación del negocio. Donde una entrada compara alternativas, es porque el documento correspondiente de esta carpeta remite aquí explícitamente — no se repite la justificación en los dos lugares.

## #1 — `company_id` en `scheduling.availability_slots` pese al diseño deliberadamente "ciego" de Scheduling

**Contexto**: `AvailabilitySlot` está modelado, por diseño de dominio explícito, sin ningún conocimiento de `Company`, `Vehicle` ni ningún concepto de negocio de Rental Operations ([model/01-BOUNDED_CONTEXTS.md §3.3](../model/01-BOUNDED_CONTEXTS.md)). La invariante transversal de plataforma INV-P01 exige, sin embargo, que toda tabla de negocio tenga `company_id` para RLS ([model/07-INVARIANTS.md §3](../model/07-INVARIANTS.md)).

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| No incluir `company_id` en `availability_slots`; resolver el aislamiento de tenant vía el `resourceId` (que en la práctica es un `VehicleId` de un tenant conocido) | Descartada: obligaría a una política RLS con subquery hacia `rental.vehicles` — imposible además porque es una FK inter-schema que este mismo modelo prohíbe ([03-RELACIONES.md §1](03-RELACIONES.md)); dejaría a `Scheduling` sin aislamiento de tenant real, la única tabla del modelo en esa situación |
| Incluir `company_id` como columna de infraestructura, nunca leída por `domain/` de `Scheduling` | **Elegida** |

**Decisión**: `availability_slots` lleva `company_id NOT NULL`, poblado por la capa de aplicación de `Rental Operations` (quien sí conoce el tenant) al invocar `CalendarPort.occupy(...)`, y usado exclusivamente por la política RLS — nunca expuesto en el contrato de dominio de `AvailabilitySlot` ni en su Value Object `ResourceRef`.

**Por qué no viola la ACL**: la contaminación que [model/01-BOUNDED_CONTEXTS.md §4.2](../model/01-BOUNDED_CONTEXTS.md) prohíbe es de **lenguaje de negocio** (`licensePlate`, `odometer`) — conceptos que un desarrollador de `Scheduling` necesitaría entender para escribir una regla. `company_id` no es lenguaje de negocio de ningún Bounded Context: es infraestructura de seguridad transversal que ya existe, con el mismo significado, en las 31 tablas del modelo. Que también exista aquí no le enseña nada nuevo sobre "qué es un recurso" al dominio de `Scheduling`.

## #2 — Tabla única de `outbox_event` con `source_schema`, no una tabla por schema

**Contexto**: [technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md) deja explícitamente como "decisión de detalle libre para la implementación" si el Outbox es una tabla por schema o una única tabla en `support` con columna `source_schema`.

**Alternativas consideradas**:
| Alternativa | Ventajas | Por qué se descartó |
|---|---|---|
| Una tabla `outbox_event` por schema (6 tablas) | Ownership de archivo más simétrico con el resto del modelo (§2 de [01-SCHEMAS.md](01-SCHEMAS.md)) | El `OutboxRelayWorker` ([technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md)) tendría que hacer polling sobre 6 tablas en vez de 1 — más consultas periódicas, más índices parciales que mantener, sin beneficio real: el worker es un proceso transversal de plataforma, no un módulo de negocio con ownership de dominio |
| **Una única tabla `outbox_event` en `support`, con `source_schema`** | Un único índice parcial `WHERE published_at IS NULL` que cubre todo el sistema ([05-INDICES-Y-CONSTRAINTS.md §2](05-INDICES-Y-CONSTRAINTS.md)); un único punto de observabilidad operativa ("cuántos eventos pendientes hay en todo el sistema") | — (elegida) |

**Decisión**: tabla única `support.outbox_event`, coherente con que el Outbox no pertenece a ningún Bounded Context ([01-SCHEMAS.md §5](01-SCHEMAS.md)) — se aloja en `support` por conveniencia operativa, no por ownership de dominio.

## #3 — Propietario polimórfico de `identity_documents` vía dos FK nulables, no `owner_type`/`owner_id` genérico

**Contexto**: `IdentityDocument` es entidad interna de `Customer` **y** de `AdditionalDriver` ([model/02-AGGREGATES.md §10](../model/02-AGGREGATES.md)), nunca de ambos simultáneamente para la misma fila.

**Alternativas consideradas**:
| Alternativa | Ventajas | Por qué se descartó |
|---|---|---|
| `owner_type` (enum) + `owner_id` (UUID opaco), sin FK, integridad solo de aplicación — mismo patrón que `audit_log.subject_type`/`subject_id` | Extensible sin migración si apareciera un tercer tipo de propietario | El conjunto de propietarios posibles es fijo y conocido (dos tipos, ambos del mismo schema) — a diferencia de `audit_log`, que audita *cualquier* agregado presente y futuro de *cualquier* schema; renunciar a integridad referencial real disponible sin necesidad sería una regresión de calidad de datos, no una ganancia de flexibilidad genuina |
| **Dos columnas FK nulables mutuamente excluyentes** (`customer_id`, `additional_driver_id`) + `CHECK` de exclusividad | Integridad referencial real vía FK normal; el `CHECK` hace explícita e irrompible la regla "pertenece a exactamente uno" | — (elegida) |

**Decisión**: dos FK nulables + `CHECK ((customer_id IS NOT NULL) != (additional_driver_id IS NOT NULL))` (exclusividad estricta, ni ambos nulos ni ambos poblados).

## #4 — `payments.target_id` uniformemente opaco, sin FK ni siquiera hacia `security_deposits` (mismo schema)

**Contexto**: `Payment` referencia una `Invoice` (schema `rental`) o una `SecurityDeposit` (mismo schema `commerce`) según el tipo de cobro ([model/02-AGGREGATES.md §13](../model/02-AGGREGATES.md)).

**Alternativas consideradas**:
| Alternativa | Ventajas | Por qué se descartó |
|---|---|---|
| FK condicional: hacia `security_deposits` cuando `target_type = 'deposit'` (aprovechando que comparten schema), opaco cuando `target_type = 'invoice'` | Integridad referencial "gratis" en el caso `deposit` | Introduce una asimetría de modelado que depende de un accidente de empaquetado físico (que ambos vivan hoy en `commerce`) — si `SecurityDeposit` se reubicara físicamente en el futuro, el tipo de constraint de esta columna cambiaría sin que la regla de negocio lo justifique; un desarrollador leyendo el schema tendría que recordar "por qué a veces sí y a veces no" sin una razón de dominio, solo de empaquetado |
| **`target_type` + `target_id` uniformemente opacos en ambos casos, integridad verificada en `application/`** | Un único patrón de lectura del modelo, independiente de dónde vivan físicamente los dos posibles destinos hoy o en el futuro | — (elegida) |

**Decisión**: `payments.target_id` nunca es FK, en ningún caso — la integridad se garantiza en el Command Handler que crea el `Payment` (valida que el `target_id` referenciado existe, vía el puerto correspondiente), coherente con el mismo principio ya aplicado a toda referencia inter-schema del modelo ([04-MODELO-DATOS.md §3](../04-MODELO-DATOS.md)).

## #5 — Columna `version` para concurrencia optimista en todo Aggregate Root

**Contexto**: ningún documento de dominio o de arquitectura ya aprobado fija un mecanismo de control de concurrencia para escrituras simultáneas sobre el mismo agregado (p. ej. dos operadores confirmando check-out sobre la misma `Reservation` casi simultáneamente).

**Alternativas consideradas**:
| Alternativa | Ventajas | Por qué se descartó |
|---|---|---|
| Confiar únicamente en el nivel de aislamiento transaccional de PostgreSQL (`READ COMMITTED` por defecto) | Cero columnas adicionales | Bajo `READ COMMITTED`, dos transacciones concurrentes pueden leer el mismo estado, decidir cada una una transición válida, y la segunda en persistir sobrescribe silenciosamente el efecto de la primera ("lost update") — exactamente el tipo de bug que un mecanismo de agregado transaccional (`UnitOfWork`, [technical/04-PERSISTENCE.md §3](../technical/04-PERSISTENCE.md)) debería impedir de forma mecánica, no solo esperar que no ocurra |
| Bloqueo pesimista (`SELECT ... FOR UPDATE`) en toda carga de agregado | Previene la condición de carrera sin columna adicional | Introduce contención de bloqueos donde no siempre es necesaria (la mayoría de los agregados de este modelo no tienen alta concurrencia de escritura); es además más difícil de razonar bajo connection pooling en modo *transaction* ya fijado para RLS ([technical/04-PERSISTENCE.md §5](../technical/04-PERSISTENCE.md)) |
| **Columna `version` (entero, incrementado en cada `UPDATE`) en todo Aggregate Root, verificada en la cláusula `WHERE` de cada escritura** | Detecta la colisión sin bloqueo pesimista; el repositorio simplemente falla la escritura (y el Command Handler puede reintentar o informar conflicto) si `version` no coincide — mecánico, barato, y coherente con que "un agregado se carga, se modifica y se persiste como unidad" ([model/02-AGGREGATES.md](../model/02-AGGREGATES.md)) | — (elegida) |

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
| Alternativa | Ventajas | Por qué se descartó / eligió |
|---|---|---|
| Mantener una sola capa (el VO de dominio) | Cero cambio, fiel estrictamente a lo ya documentado | Un `CHECK` sobre dos columnas de la misma fila tiene costo de mantenimiento nulo (no requiere índice, no requiere extensión, no coordina con otras filas) — el costo de agregarlo es tan bajo que no agregarlo sería inconsistente con el resto del modelo, que sí invierte en defensa en profundidad barata en otros puntos |
| **Agregar `CHECK (end > start)` en `reservations`, `availability_slots`, `rates`** | Protege contra un bug de un futuro repositorio o script administrativo que escriba directamente sin pasar por el VO de dominio (p. ej. un backfill de migración, §2 de [07-MIGRACIONES.md](07-MIGRACIONES.md)) | — (elegida) |

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
| Alternativa | Ventajas | Por qué se descartó / eligió |
|---|---|---|
| `String` + `CHECK (status IN (...))` | Agregar un valor nuevo al catálogo no requiere `ALTER TYPE` (una operación con restricciones históricas de PostgreSQL, aunque PG 12+ permite `ADD VALUE` fuera de una transacción explícita sin bloqueo mayor) | Columna más pesada en almacenamiento e índice frente a un enum nativo; el `CHECK` debe mantenerse manualmente sincronizado con el VO de dominio sin la garantía de tipo que Prisma genera automáticamente a partir de un `enum` |
| **Enum nativo de Prisma (`ENUM` de PostgreSQL)** | Tipado end-to-end automático (el enum de Prisma genera el tipo TypeScript correspondiente sin mapeo manual); almacenamiento más compacto; el propio motor rechaza un valor fuera de catálogo sin necesidad de un `CHECK` redundante | Agregar un valor nuevo es una migración `ALTER TYPE ... ADD VALUE`, ejecutada como su propia migración (no dentro de una transacción que también la usa, restricción real de PostgreSQL) — aceptado como trade-off menor porque las máquinas de estado de este modelo ([model/08-STATE_MACHINES.md](../model/08-STATE_MACHINES.md)) son deliberadamente estables y cualquier estado nuevo ya requeriría, de todos modos, revisar la máquina de estados completa en el dominio antes de tocar el esquema |

**Decisión**: enum nativo de Prisma para toda enumeración cerrada de estado; arreglo de `String`/enum para conjuntos configurables simultáneos (`PaymentMethodsEnabled`, `EnabledProductModules`), donde la cardinalidad múltiple (no la volatilidad del catálogo) es la razón de la diferencia de tratamiento. Ver desarrollo completo en [08-PRISMA-CONVENTIONS.md §7](08-PRISMA-CONVENTIONS.md).

## Qué NO se registra en este documento

- Decisiones ya tomadas en `docs/`, `docs/ADR/`, `docs/model/` o `docs/technical/` — se heredan, se citan, nunca se repiten aquí como si fueran nuevas.
- Valores de calibración dependientes de datos reales de producción (tamaño de pool, parámetros de `argon2id`, umbrales de rate limiting) — diferidos a Fase 6, mismo criterio ya usado en todo `docs/technical/`.
