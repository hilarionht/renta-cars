# 03 — Relaciones

Este documento clasifica toda relación entre las 30 tablas de [02-TABLAS.md](02-TABLAS.md). Cada relación se clasifica en dos dimensiones independientes:

- **Alcance físico**: **intra-schema** (ambas tablas en el mismo schema de PostgreSQL) vs. **inter-schema** (schemas distintos).
- **Mecanismo**: **FK** (constraint físico de integridad referencial) vs. **referencia lógica** (columna de ID sin constraint, integridad garantizada en `application/`) vs. **por evento** (sin columna persistente que las una directamente; la correlación ocurre a través del payload de un evento de dominio ya consumido).

**Regla general, ya fijada y heredada sin modificación** ([04-MODELO-DATOS.md §3](../04-MODELO-DATOS.md)): toda relación intra-schema puede ser FK; ninguna relación inter-schema lo es nunca, sin excepción.

## 1. Regla de decisión (cuándo SÍ y cuándo NO usar FK)

| Pregunta | Si la respuesta es sí |
|---|---|
| ¿Las dos tablas viven en el mismo schema de PostgreSQL? | Condición necesaria (no suficiente) para considerar FK |
| ¿La relación representa una pertenencia estructural real (entidad interna → agregado raíz, o cross-aggregate dentro del mismo Bounded Context con integridad que el propio caso de uso ya garantiza)? | Se usa FK, con `ON DELETE` explícito (§4) |
| ¿La relación cruza un Bounded Context, aunque por empaquetado físico ambas tablas coincidan en el mismo schema (p. ej. `commerce.security_deposits` → `rental.invoices` nunca aplica porque son schemas distintos, pero si coincidieran)? | Igual se trata como si fuera inter-schema — el criterio de fondo es el Bounded Context, el schema es solo su proyección física habitual |
| ¿El agregado proveedor pertenece deliberadamente a un Bounded Context "ciego" al proveedor (`Scheduling` respecto a `Vehicle`, `Support` respecto a todo lo demás)? | Nunca FK, incluso si por accidente compartieran schema — es una decisión de aislamiento de lenguaje ubicuo, no solo de motor de base de datos |

**Por qué nunca FK cross-schema** (heredado de [04-MODELO-DATOS.md §3](../04-MODELO-DATOS.md), reafirmado aquí a nivel de cada relación concreta): una FK entre schemas es un acoplamiento físico entre Bounded Contexts al nivel del motor de base de datos — el mismo acoplamiento que INV-P02/INV-P03 ([model/07-INVARIANTS.md §3](../model/07-INVARIANTS.md)) prohíben a nivel de código. Una FK cross-schema, además, bloquearía mecánicamente la extracción futura de un Bounded Context a un servicio con base de datos propia (§2 de [00-VISION.md](../00-VISION.md)) — migrar un schema completo es mecánico solo si ninguna tabla de otro schema depende de él a nivel de motor.

## 2. Relaciones intra-schema con FK

### 2.1 `identity`

| Origen | Destino | Naturaleza | `ON DELETE` |
|---|---|---|---|
| `sessions.user_id` | `users.id` | Cross-aggregate (`Session` referencia `User`) | `RESTRICT` — un `User` con sesiones históricas no se borra físicamente (coherente con [model/03-ENTITIES.md §1.1](../model/03-ENTITIES.md)) |
| `user_roles.user_id` | `users.id` | Unión (parte del agregado `User`) | `CASCADE` — la fila de unión no tiene sentido sin el `User` que la posee |
| `user_roles.role_id` | `roles.id` | Unión → agregado referenciado | `RESTRICT` — un `Role` en uso no se elimina; se desactiva (`Custom`) o es inmutable (`System`) |

### 2.2 `organization`

| Origen | Destino | Naturaleza | `ON DELETE` |
|---|---|---|---|
| `branches.company_id` | `companies.id` | Cross-aggregate, mismo BC | `RESTRICT` — una `Company` con sucursales no se borra (retención regulatoria, [model/03-ENTITIES.md §2.1](../model/03-ENTITIES.md)) |
| `company_settings.company_id` | `companies.id` | Identidad 1:1 (configuración-de, no composición) | `RESTRICT` — `CompanySettings` nunca se elimina mientras la `Company` exista |

### 2.3 `rental`

| Origen | Destino | Naturaleza | `ON DELETE` |
|---|---|---|---|
| `rates.vehicle_category_id` | `vehicle_categories.id` | Entidad interna → raíz | `CASCADE` — una tarifa no existe sin su categoría; en la práctica nunca se ejecuta porque `vehicle_categories` no se elimina en el flujo de negocio ordinario |
| `vehicles.vehicle_category_id` | `vehicle_categories.id` | Cross-aggregate, mismo BC | `RESTRICT` — no se elimina una categoría con vehículos activos asociados |
| `vehicle_documents.vehicle_id` | `vehicles.id` | Entidad interna → raíz | `CASCADE` |
| `maintenance_records.vehicle_id` | `vehicles.id` | Entidad interna → raíz | `CASCADE` |
| `maintenance_records.damage_report_id` (nullable) | `damage_reports.id` | Cross-aggregate, mismo BC (origen correctivo) | `RESTRICT` — un `DamageReport` referenciado como origen de un mantenimiento no se elimina |
| `identity_documents.customer_id` (nullable, ver §5) | `customers.id` | Entidad interna → raíz (propietario 1 de 2) | `CASCADE` |
| `identity_documents.additional_driver_id` (nullable, ver §5) | `additional_drivers.id` | Entidad interna → raíz (propietario 2 de 2) | `CASCADE` |
| `additional_drivers.customer_id` | `customers.id` | Entidad interna → raíz | `CASCADE` |
| `reservation_authorized_drivers.reservation_id` | `reservations.id` | Unión (parte del agregado `Reservation`) | `CASCADE` |
| `reservation_authorized_drivers.additional_driver_id` | `additional_drivers.id` | Unión → agregado referenciado | `RESTRICT` |
| `reservations.customer_id` | `customers.id` | Cross-aggregate, mismo BC | `RESTRICT` |
| `reservations.vehicle_id` | `vehicles.id` | Cross-aggregate, mismo BC | `RESTRICT` |
| `inspections.reservation_id` | `reservations.id` | Entidad interna → raíz | `CASCADE` |
| `price_adjustments.reservation_id` | `reservations.id` | Entidad interna → raíz (a efectos de persistencia, ver [02-TABLAS.md §4.16](02-TABLAS.md)) | `CASCADE` |
| `inspection_photos.inspection_id` | `inspections.id` | Unión (parte del agregado `Reservation`) | `CASCADE` |
| `damage_reports.reservation_id` | `reservations.id` | Entidad interna → raíz | `CASCADE` |
| `damage_reports.inspection_id` | `inspections.id` | Cross-aggregate interno (misma raíz `Reservation`) | `RESTRICT` — la inspección que detectó un daño no se elimina mientras el daño exista |
| `damage_report_photos.damage_report_id` | `damage_reports.id` | Unión (parte del agregado `Reservation`) | `CASCADE` |
| `invoices.reservation_id` | `reservations.id` | Cross-aggregate, mismo schema por empaquetado físico (§3.1 de [01-SCHEMAS.md](01-SCHEMAS.md)) | `RESTRICT` — integridad fiscal: una `Invoice` nunca queda huérfana de su `Reservation` de origen |
| `invoices.customer_id` | `customers.id` | Cross-aggregate, mismo schema por empaquetado físico | `RESTRICT` |
| `charges.invoice_id` | `invoices.id` | Entidad interna → raíz | `CASCADE` |

**Nota sobre `invoices` → `reservations`/`customers`**: esta FK existe únicamente porque `Invoice` está empaquetada físicamente en `rental` (decisión ya fijada, [01-SCHEMAS.md §3.1](01-SCHEMAS.md)); es una excepción de conveniencia física, no una señal de que Commerce y Rental Operations dejen de ser Bounded Contexts distintos a nivel de reglas. Si `Invoice` se extrajera algún día a su propio schema (el día que exista un segundo producto que lo justifique), esta FK se convertiría en referencia lógica — cambio mecánico, ya anticipado por el propio modelo de dominio.

## 3. Relaciones inter-schema (siempre referencia lógica, nunca FK)

| Columna de origen | Tabla/concepto destino (otro schema) | Por qué nunca FK |
|---|---|---|
| `vehicles.branch_id` | `organization.branches.id` | Cross-schema; la integridad se valida en `application/` al crear el `Vehicle` (el caso de uso consulta `BranchStatusPort`) |
| `customers.company_id`, `vehicles.company_id`, `reservations.company_id`, `invoices.company_id`, … (todo `company_id` de cualquier tabla) | `organization.companies.id` | Cross-schema; es, además, la columna de aislamiento de tenant (RLS), no solo una referencia de negocio — ver [06-RLS.md](06-RLS.md) |
| `reservations.*` (consulta, no columna persistida) → `CompanySettings` vigente | `organization.company_settings` | Se lee vía puerto síncrono en el momento del cálculo, nunca se copia ni cachea en `reservations` ([model/02-AGGREGATES.md §6](../model/02-AGGREGATES.md)) — no hay columna que correlacionar |
| `reservations.inspections.inspected_by`, `vehicles.maintenance_records.responsible_user_id` | `identity.users.id` | Cross-schema; `Rental Operations` nunca depende de `Identity & Access` a nivel de motor de base de datos, solo consulta su identidad vía `RequestContext` ya resuelto |
| `vehicle_documents.file_id`, `identity_documents.file_id`, `inspection_photos.file_id`, `damage_report_photos.file_id`, `invoices.pdf_file_id` | `support.files.id` | Cross-schema; `File` no conoce ni debe conocer quién lo referencia ([model/02-AGGREGATES.md §15](../model/02-AGGREGATES.md)) |
| `payments.target_id` (polimórfico: `invoice_id` o `security_deposit_id`) | `rental.invoices.id` **o** `commerce.security_deposits.id` | Cross-schema en ambos casos (`Payment` vive en `commerce`, `Invoice` en `rental`); tratamiento polimórfico detallado en §6 |
| `security_deposits.reservation_id` | `rental.reservations.id` | Cross-schema (`SecurityDeposit` vive en `commerce`) |
| `availability_slots.resource_id` (cuando `resource_type = "vehicle"`) | `rental.vehicles.id` | Nunca FK ni siquiera conceptualmente tipada — es el núcleo de la ACL de Scheduling ([model/01-BOUNDED_CONTEXTS.md §4.2](../model/01-BOUNDED_CONTEXTS.md)); `Scheduling` no sabe que ese string es, en la práctica, un `VehicleId` |
| `availability_slots.reference_id` (cuando `slot_kind = "Booking"`) | `rental.reservations.id` | Misma razón — opaco por diseño |
| `notifications.*` | cualquier agregado origen | `Notification` no guarda ninguna columna de correlación tipada hacia el agregado que la originó, solo el payload de contexto ya resuelto al crearla ([model/02-AGGREGATES.md §16](../model/02-AGGREGATES.md)) |
| `audit_log.subject_type` + `audit_log.subject_id` | cualquier agregado de cualquier schema | Deliberadamente genérico — el propósito de `AuditLogEntry` es no depender del modelo interno de lo que audita |
| `outbox_event.aggregate_type` + `outbox_event.aggregate_id` | cualquier agregado de cualquier schema | El outbox sobrevive conceptualmente a cambios en el agregado que lo originó; nunca until una FK |

## 4. Relaciones "por evento" (sin columna persistente que las una)

Estas son relaciones de negocio reales (documentadas en [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md) y [model/09-DEPENDENCIES.md §4](../model/09-DEPENDENCIES.md)) que **no** se materializan como columna de FK ni de referencia lógica persistente en la tabla consumidora — la tabla consumidora ya tiene, en el momento de escribir su propia fila, todo el dato que necesita, copiado del payload del evento ya recibido:

| Relación de negocio | Cómo se materializa físicamente |
|---|---|
| `Vehicle` refleja `Reserved`/`CheckedOut`/`Available` según el ciclo de `Reservation` | `vehicles.status` se actualiza por un comando propio disparado por un listener que reacciona a `ReservationConfirmed.v1`/`ReservationCheckedOut.v1`/`ReservationCheckedIn.v1` — no hay columna en `vehicles` que apunte a la `reservation` activa; la relación vive en el hecho de que ambos comandos ocurrieron en transacciones separadas correlacionadas por evento, no por constraint |
| `Invoice` se emite reaccionando a `ReservationCheckedIn.v1` | `invoices.reservation_id` **sí** es columna (y FK, §2.3, por el empaquetado físico) — pero el `PriceBreakdown`/`charges[]` que la puebla nunca se lee vía `JOIN` a `reservations`; se copia del payload del evento en el momento de la inserción, coherente con INV-110 |
| `Payment` inicia cobro reaccionando a `InvoiceIssued.v1` | `payments.target_id` se puebla con el `invoiceId` del payload del evento, no vía consulta a `rental.invoices` |
| `AuditLogEntry` registra todo evento de dominio | `audit_log` se puebla enteramente desde el payload de cada evento consumido por el listener transversal — nunca consulta la tabla de origen |
| `Notification` se crea reaccionando a eventos de cualquier BC | Mismo mecanismo — el contenido para componer el mensaje viene del payload, nunca de una consulta a la tabla origen |

**Por qué esta distinción importa para quien implemente Prisma**: una relación "por evento" no debe modelarse como relación de Prisma (`@relation`) en absoluto, ni siquiera como campo opcional sin FK — es, a efectos del schema, dos tablas completamente independientes que comparten un dato copiado en un instante pasado. Modelarla como relación Prisma (aunque fuera `@relation(fields: ..., references: ...)` sin constraint física) induciría a un desarrollador a escribir un `include`/`JOIN` que no debe existir.

## 5. Caso especial: propietario polimórfico de `identity_documents`

`IdentityDocument` es, por diseño de dominio ya fijado, entidad interna tanto de `Customer` como de `AdditionalDriver` ([model/02-AGGREGATES.md §10](../model/02-AGGREGATES.md), [model/03-ENTITIES.md §4.7](../model/03-ENTITIES.md)) — nunca de ambos a la vez para la misma fila. Se modela con **dos columnas FK nulables mutuamente excluyentes** (`customer_id`, `additional_driver_id`) más un `CHECK` que garantiza que exactamente una de las dos está poblada (detalle del constraint en [05-INDICES-Y-CONSTRAINTS.md §4](05-INDICES-Y-CONSTRAINTS.md)).

**Alternativa descartada**: una columna única `owner_type` + `owner_id` genérica (sin FK, integridad solo de aplicación) — se descartó porque, a diferencia de `audit_log.subject_type`/`subject_id` (que es deliberadamente débil porque audita *cualquier* agregado de *cualquier* schema presente y futuro), aquí el propietario es siempre uno de exactamente dos tipos conocidos, ambos del mismo schema — perder la FK real sin necesidad renunciaría a integridad referencial gratis que sí está disponible. Justificación extendida en [10-DECISIONES.md](10-DECISIONES.md) #3.

## 6. Caso especial: referencia polimórfica de `payments.target_id`

`Payment` referencia, según el propio modelo de dominio, "una referencia opaca a `Charge`/`Invoice` (o a `SecurityDeposit` si es una preautorización de garantía)" ([model/02-AGGREGATES.md §13](../model/02-AGGREGATES.md)). A diferencia de `identity_documents` (§5), aquí los dos destinos posibles **no** comparten schema: `security_deposits` vive en `commerce` (mismo schema que `payments`) e `invoices` vive en `rental` (schema distinto). Se decidió **no** aplicar FK ni siquiera hacia `security_deposits` pese a compartir schema — tratamiento uniforme (`target_type` + `target_id` opacos, sin FK en ningún caso) en lugar de una FK condicional según el tipo de destino. Justificación completa (por qué no aprovechar la FK "gratis" disponible hacia `security_deposits`) en [10-DECISIONES.md](10-DECISIONES.md) #4.

## 7. Resumen cuantitativo

| Tipo de relación | Cantidad aproximada | Dónde se aplica |
|---|---|---|
| FK intra-schema | 20 | Dentro de `identity`, `organization`, `rental` (ver tablas de §2) |
| Referencia lógica inter-schema (columna sin FK) | 15+ | Todo `company_id`, todo `file_id`, `branch_id`, `user_id` de auditoría/operación, `payments.target_id`, `security_deposits.reservation_id`, `availability_slots.resource_id`/`reference_id` |
| Relación "por evento" (sin columna de correlación viva) | 5 | `Vehicle` ← ciclo de `Reservation`; `Invoice` ← `ReservationCheckedIn.v1`; `Payment` ← `InvoiceIssued.v1`; `AuditLogEntry` ← todo evento; `Notification` ← todo evento |

Ninguna tabla de este modelo tiene una FK que cruce de `platform` (`identity`, `organization`, `scheduling`, `commerce`, `support`) hacia `rental` en ningún sentido — verificación mecánica de INV-P03 ya señalada en [01-SCHEMAS.md §4](01-SCHEMAS.md).
