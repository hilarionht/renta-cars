# 04 — Columnas Conceptuales

Este documento define, para cada tabla de [02-TABLAS.md](02-TABLAS.md), sus columnas al nivel conceptual: identificador, claves naturales, timestamps, versionado, auditoría, tenant, soft delete y ownership. **Sin tipos SQL** — "identificador" describe qué identifica y con qué garantía, no `UUID` como palabra reservada de PostgreSQL; el tipo concreto ya está fijado como regla general en [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md) y no se repite aquí campo por campo salvo cuando hay una razón para desviarse.

## 1. Dimensiones comunes a toda tabla (regla general, no repetida por tabla salvo excepción)

| Dimensión | Regla general | Excepciones |
|---|---|---|
| **Identificador** | Un identificador propio, ordenable por tiempo de creación, como clave primaria de toda tabla — ya fijado en [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md) y en el VO `EntityId<T>` ([model/04-VALUE_OBJECTS.md §1.3](../model/04-VALUE_OBJECTS.md)). Las tablas de unión (§7) son la única excepción — su identificador es la combinación de las FK que la componen, no un identificador propio | `user_roles`, `reservation_authorized_drivers`, `inspection_photos`, `damage_report_photos` |
| **Timestamps** | `created_at` (siempre) + `updated_at` (siempre, incluso en tablas de entidades append-only, donde `updated_at` coincide con `created_at` de por vida — se mantiene por uniformidad de infraestructura, no porque la fila vaya a cambiar) | Ninguna |
| **Tenant** | `company_id`, obligatorio, denormalizado en la propia fila — nunca resuelto solo por `JOIN` al padre, incluso cuando la tabla es una entidad interna cuyo agregado raíz ya lo tiene. Ver justificación en §2 | `companies` (es la raíz de tenant, no tiene su propio `company_id`); catálogo de sistema (`roles` de alcance `System`, ver §3) |
| **Soft delete** | Ausente por defecto — borrado físico o campo de estado (`status`), según el ciclo de vida ya fijado por el agregado | Presente únicamente en `reservations` e `invoices` ([04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)) |
| **Versionado (concurrencia)** | Columna de control optimista en todo Aggregate Root — nunca en una entidad interna, que se persiste siempre junto a su raíz dentro de la misma transacción. Ver justificación en [10-DECISIONES.md](10-DECISIONES.md) #5 | Entidades internas (no llevan su propia versión — la protege la de su raíz) |
| **Auditoría (actor)** | No se agrega una columna genérica `updated_by`/`created_by` a toda tabla — el actor de cada cambio de negocio ya se registra en `audit_log` vía evento ([model/02-AGGREGATES.md §17](../model/02-AGGREGATES.md)). Solo se agrega una columna de actor cuando el propio modelo de dominio ya la exige como dato estructural del agregado (p. ej. `inspected_by`), nunca como mecanismo de auditoría paralelo | Ver columna "Actor propio del dominio" en las tablas de §3-§8 |

## 2. Por qué `company_id` se denormaliza en cada tabla (no solo en la raíz)

Row-Level Security se evalúa **por tabla**, no por agregado ([06-RLS.md](06-RLS.md)) — una política RLS que dependa de un `JOIN` a la tabla padre para conocer el tenant es más lenta, más frágil (una política mal escrita podría omitir el `JOIN`) y rompe la garantía de que "toda tabla de negocio... incluye `company_id`" ya fijada literalmente en [04-MODELO-DATOS.md §4](../04-MODELO-DATOS.md). Por eso toda tabla de este modelo — incluidas las entidades internas (`rates`, `vehicle_documents`, `inspections`, `charges`, etc.) y las tablas de unión — lleva su propio `company_id`, copiado del agregado raíz en el momento de creación e inmutable después (una entidad interna nunca cambia de tenant sin que su raíz completa lo haga, lo cual no es una operación de negocio modelada). El costo de esta denormalización es una columna adicional por tabla; el beneficio es que ninguna política RLS de este modelo necesita nunca un `JOIN` — ver detalle en [06-RLS.md §2](06-RLS.md).

## 3. Identity & Access

| Tabla | Clave(s) natural(es) | Tenant | Actor propio del dominio | Notas de versionado/lifecycle |
|---|---|---|---|---|
| `users` | `(company_id, email)` — INV-014 | `company_id` NOT NULL | — | `version` (Aggregate Root) |
| `roles` | `role_name`, único condicionalmente según alcance (ver [05-INDICES-Y-CONSTRAINTS.md §3](05-INDICES-Y-CONSTRAINTS.md)) | `company_id` **nulable** — único caso de tenant opcional de todo el modelo: `NULL` identifica un rol `System` (global, visible a toda Company); ver caso especial en [06-RLS.md §4](06-RLS.md) | — | `version` |
| `user_roles` | `(user_id, role_id)` | `company_id` (heredado del `User`) | — | Sin versión propia (tabla de unión) |
| `sessions` | ninguna (dos sesiones del mismo `User` son entidades distintas, [model/03-ENTITIES.md §1.3](../model/03-ENTITIES.md)) | `company_id` (heredado del `User`, denormalizado para RLS directa) | — | `version` |

## 4. Organization

| Tabla | Clave(s) natural(es) | Tenant | Actor propio del dominio | Notas de versionado/lifecycle |
|---|---|---|---|---|
| `companies` | `tax_id` — único a nivel de Plataforma (INV-016, la única unicidad verdaderamente global de todo el modelo) | Es la raíz de tenant — no tiene `company_id` propio, su propio `id` **es** el valor de tenant que toda otra tabla porta | — | `version` |
| `branches` | ninguna universal (dirección no es clave natural) | `company_id` NOT NULL | — | `version` |
| `company_settings` | identidad = `company_id` (relación 1:1, no un identificador propio distinto — [model/03-ENTITIES.md §2.3](../model/03-ENTITIES.md)) | `company_id` NOT NULL, y además es la propia clave primaria (no hay un segundo `id` autónomo) | — | `version` |

## 5. Scheduling

| Tabla | Clave(s) natural(es) | Tenant | Actor propio del dominio | Notas de versionado/lifecycle |
|---|---|---|---|---|
| `availability_slots` | `(resource_type, resource_id, date_range)` sin solapamiento activo — protegido por exclusion constraint, no por unicidad simple ([05-INDICES-Y-CONSTRAINTS.md §5](05-INDICES-Y-CONSTRAINTS.md)) | `company_id` NOT NULL — infraestructura de aislamiento, nunca leída por el `domain/` de `Scheduling` (ver [01-SCHEMAS.md §4.3](01-SCHEMAS.md)) | — | `version`; sin `updated_at` significativo más allá de la liberación (el rango nunca se edita, [model/08-STATE_MACHINES.md §6.8](../model/08-STATE_MACHINES.md)) |

## 6. Rental Operations (schema `rental`)

| Tabla | Clave(s) natural(es) | Tenant | Actor propio del dominio | Notas de versionado/lifecycle |
|---|---|---|---|---|
| `vehicle_categories` | `(company_id, category_name)` | `company_id` NOT NULL | — | `version` |
| `rates` | `(vehicle_category_id, valid_from)` sin solapamiento de vigencia (INV-010) | `company_id` NOT NULL | — | Append-only; sin `version` propio (entidad interna) |
| `vehicles` | `(company_id, license_plate)` — ver nota abajo; `vin` | `company_id` NOT NULL | — | `version` |
| `vehicle_documents` | `(vehicle_id, document_type)` para el documento **vigente** (ver constraint parcial en [05-INDICES-Y-CONSTRAINTS.md §4](05-INDICES-Y-CONSTRAINTS.md)) | `company_id` NOT NULL | — | Append-only; sin `version` propio |
| `maintenance_records` | ninguna | `company_id` NOT NULL | `responsible_user_id` (opaco, cross-schema — el Responsable de Mantenimiento que decide la transición) | Append-only; sin `version` propio |
| `customers` | `(company_id, tax_id_or_document_id)` | `company_id` NOT NULL | — | `version` |
| `identity_documents` | `(owner, document_type)` para el documento vigente (propietario polimórfico, [03-RELACIONES.md §5](03-RELACIONES.md)) | `company_id` NOT NULL | — | Append-only; sin `version` propio; `extracted_by_ocr` (booleano, INV-011) |
| `additional_drivers` | ninguna | `company_id` NOT NULL | — | `version` |
| `reservation_authorized_drivers` | `(reservation_id, additional_driver_id)` | `company_id` NOT NULL | — | Sin versión propia (tabla de unión) |
| `reservations` | ninguna (dos reservas del mismo cliente/vehículo en fechas distintas son entidades distintas) | `company_id` NOT NULL | — | `version` (alta concurrencia de escritura durante `checkOut`/`checkIn`/extensión); `deleted_at` (única junto con `invoices`) |
| `inspections` | `(reservation_id, type)` — a lo sumo una `CheckOut` y una `CheckIn` por reserva | `company_id` NOT NULL | `inspected_by` (opaco, cross-schema — el Operador de Sucursal) | Append-only; sin `version` propio |
| `inspection_photos` | `(inspection_id, file_id)` | `company_id` NOT NULL | — | Sin versión propia (tabla de unión) |
| `damage_reports` | ninguna | `company_id` NOT NULL | — | Append-only; sin `version` propio; `imputable_to_customer` (booleano, dato estructural del dominio, no columna de auditoría) |
| `damage_report_photos` | `(damage_report_id, file_id)` | `company_id` NOT NULL | — | Sin versión propia (tabla de unión) |
| `invoices` | `invoice_number` — único por serie/país (RN-23); `reservation_id` único condicional (INV-023, [05-INDICES-Y-CONSTRAINTS.md §3](05-INDICES-Y-CONSTRAINTS.md)) | `company_id` NOT NULL | — | `version`; `deleted_at` (única junto con `reservations`) |
| `charges` | ninguna | `company_id` NOT NULL | — | Append-only (INV-022); sin `version` propio |

**Nota sobre `vehicles.license_plate`**: el catálogo de invariantes aprobado ([model/07-INVARIANTS.md](../model/07-INVARIANTS.md)) no fija explícitamente una regla de unicidad de placa a nivel de `Company` — es un hecho del mundo físico (una placa identifica un vehículo real) que razonablemente debería ser única, pero como no está declarado como invariante en el modelo de dominio aprobado, este documento **no** introduce una constraint de unicidad sobre `license_plate` por decisión propia; se deja como punto abierto explícito para [10-DECISIONES.md](10-DECISIONES.md) #6, a resolver con el equipo de dominio antes de implementar, no a decidir unilateralmente aquí.

## 7. Commerce (schema `commerce`)

| Tabla | Clave(s) natural(es) | Tenant | Actor propio del dominio | Notas de versionado/lifecycle |
|---|---|---|---|---|
| `payments` | `(company_id, idempotency_key)` — INV-021 | `company_id` NOT NULL | — | `version` |
| `security_deposits` | ninguna (un `reservation_id` puede tener a lo sumo un depósito vigente, ver [05-INDICES-Y-CONSTRAINTS.md §3](05-INDICES-Y-CONSTRAINTS.md)) | `company_id` NOT NULL | — | `version` |

## 8. Support (schema `support`)

| Tabla | Clave(s) natural(es) | Tenant | Actor propio del dominio | Notas de versionado/lifecycle |
|---|---|---|---|---|
| `files` | `storage_ref` (único — dos `File` nunca comparten el mismo puntero de storage) | `company_id` NOT NULL | `uploaded_by` (opaco, cross-schema) | `version` (poco relevante en la práctica, pero uniforme) |
| `notifications` | ninguna | `company_id` NOT NULL | — | `version` |
| `audit_log` | ninguna | `company_id` **nulable** — ausente solo en eventos verdaderamente globales de Plataforma (`CompanyRegistered.v1`, donde `companyId` es el propio sujeto), mismo criterio ya fijado en el envelope de eventos ([model/06-DOMAIN_EVENTS.md §1](../model/06-DOMAIN_EVENTS.md)) | `actor_ref` (genérico, puede ser un `user_id` o un identificador de actor de sistema) | Sin `version` (INV-024: nunca se actualiza tras creada) |
| `outbox_event` | `event_id` (único — es el identificador del propio evento de dominio, no un identificador de fila secundario) | `company_id` nulable (mismo criterio que `audit_log`) | — | Sin `version`; `published_at` nulable es, en sí misma, el único campo mutable de toda la fila |

## 9. Money, DateRange y otros Value Objects compuestos — cómo se representan en columna

Ningún VO de [model/04-VALUE_OBJECTS.md](../model/04-VALUE_OBJECTS.md) produce su propia tabla (ya fijado en [02-TABLAS.md §7](02-TABLAS.md)); se representan siempre como un grupo fijo de columnas dentro de la tabla que los porta:

| Value Object | Representación conceptual | Dónde aparece |
|---|---|---|
| `Money` | Cantidad como entero en unidad mínima + código de moneda ISO-4217 — nunca un único campo decimal ([04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)) | `rates.amount`, `reservations` (tarifa acordada, y cada `PriceAdjustment` dentro de su desglose — ver nota de `PriceBreakdown` abajo), `security_deposits.amount`, `payments.amount`, `charges.amount` |
| `DateRange` | Par de columnas `start`/`end` (mismo tipo, ambas obligatorias, `end` siempre posterior a `start` — reforzado con `CHECK`, [05-INDICES-Y-CONSTRAINTS.md §6](05-INDICES-Y-CONSTRAINTS.md)) | `availability_slots` (rango del slot), `reservations` (rango vigente), `rates` (vigencia, con `end` nulable — vigencia abierta) |
| `PriceBreakdown` / `PriceAdjustment[]` | **No** se aplana en columnas de `reservations` — cada ajuste es un hecho append-only propio; se modela como una tabla adicional de líneas de ajuste, hija de `reservations`, con la misma naturaleza append-only que `charges` en `invoices`. Este documento la nombra aquí porque su ausencia en el inventario de [02-TABLAS.md](02-TABLAS.md) sería una omisión — se añade como `price_adjustments` (entidad interna de `Reservation`, mismo tratamiento que `charges` de `Invoice`) | `rental.price_adjustments`, hija de `reservations` |
| `Address` | Componentes de dirección + coordenadas opcionales (enriquecidas vía `GeolocationPort`, sin que eso la convierta en entidad, [model/04-VALUE_OBJECTS.md §3](../model/04-VALUE_OBJECTS.md)) | `branches.address` |
| `ContactInfo` | `email` + `phone_number`, ambos VOs universales de `shared-kernel` | `customers.contact_email`, `customers.contact_phone` |
| `EnabledProductModules`, `PaymentMethodsEnabled` | Conjunto cerrado de valores de catálogo — columna de arreglo/enum múltiple, nunca una tabla de unión (no tienen ciclo de vida propio, se reemplazan como unidad) | `company_settings.enabled_product_modules`, `company_settings.payment_methods_enabled` |
| `CancellationPolicy`, `LateReturnPolicy`, `DepositPolicy`, `MaintenanceThresholdPolicy`, `DraftExpirationPolicy`, `MinimumBookingLeadTime`, `NotificationChannelPreference` | Cada política como grupo de columnas propio dentro de `company_settings` (nunca JSONB de negocio — cada regla interna, como el porcentaje de penalidad o la tolerancia de gracia, se valida con su propio `CHECK`, [05-INDICES-Y-CONSTRAINTS.md §6](05-INDICES-Y-CONSTRAINTS.md)) | `company_settings.*` |
| `Permission[]` de `Role` | Arreglo de claves de catálogo versionado en código, validado en `application/` contra el catálogo vigente al arrancar ([technical/07-SECURITY.md §2](../technical/07-SECURITY.md)) — nunca una FK a una tabla `permissions` inexistente | `roles.permissions` |

**Corrección de inventario respecto a [02-TABLAS.md](02-TABLAS.md)**: este documento identifica que `PriceAdjustment[]` (parte de `Reservation.PriceBreakdown`, [model/04-VALUE_OBJECTS.md §5.2](../model/04-VALUE_OBJECTS.md)) exige su propia tabla append-only (`price_adjustments`) por la misma razón que `charges` la exige en `Invoice` — un ajuste de precio es un hecho registrado en un momento distinto de la vida de la reserva, y aunque el modelo de dominio lo trate como VO compuesto dentro de `PriceBreakdown` (nunca editado campo a campo, siempre reemplazado como unidad a nivel de agregado), a nivel físico cada ajuste individual necesita persistirse como fila propia para no perder el historial cuando se agrega el siguiente ajuste. Esto **eleva el conteo total de tablas de 30 a 31** — corrección registrada explícitamente en [09-TRAZABILIDAD.md](09-TRAZABILIDAD.md) y en [10-DECISIONES.md](10-DECISIONES.md) #7, no una tabla nueva introducida sin justificación: es consecuencia mecánica de que un VO "append-only por lista" (exactamente la misma naturaleza que `Rate` o `Charge`) no cabe en un conjunto fijo de columnas sin perder historial, aunque el documento de dominio lo haya clasificado como Value Object y no como entidad — la clasificación de dominio (VO vs. entidad) responde a si el elemento tiene *identidad de negocio* referenciable desde fuera (no la tiene, por eso es VO), no a si necesita *persistencia con historial propio* (sí la necesita, por eso es tabla propia). Ambas cosas son ortogonales y este es el único punto del modelo donde la distinción se vuelve visible.
