# 02 — Tablas

Este documento deriva todas las tablas físicas a partir de los 17 agregados de [model/02-AGGREGATES.md](../model/02-AGGREGATES.md) y de sus entidades internas ([model/03-ENTITIES.md](../model/03-ENTITIES.md)). **No define columnas** — eso es [04-COLUMNAS-CONCEPTUALES.md](04-COLUMNAS-CONCEPTUALES.md) — solo el inventario de qué tabla existe, por qué, de quién es y qué ciclo de vida tiene.

**Regla de derivación usada en todo este documento**: cada Aggregate Root produce exactamente una tabla con su propio nombre (plural, `snake_case`, [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)). Cada entidad interna con identidad propia ([model/03-ENTITIES.md §criterio](../model/03-ENTITIES.md)) produce su propia tabla, hija de la tabla de su agregado raíz — nunca se colapsa una entidad interna dentro de una columna JSONB del agregado, porque JSONB está reservado para datos no estructurados o de extensión ([04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)), y toda entidad interna de este modelo tiene identidad, ciclo de vida e invariantes propias que una columna JSONB no puede indexar ni proteger con constraints. Una relación muchos-a-muchos entre dos agregados (nunca entre un agregado y su propia entidad interna, que es siempre 1:N) produce una tabla de unión propia.

Total: **31 tablas** en 6 schemas (30 derivadas directamente de un agregado o entidad interna, más `price_adjustments`, identificada en [04-COLUMNAS-CONCEPTUALES.md §9](04-COLUMNAS-CONCEPTUALES.md) como necesaria para preservar el historial append-only de `PriceAdjustment` pese a estar modelada como Value Object compuesto en el dominio — ver justificación completa ahí y en [10-DECISIONES.md](10-DECISIONES.md) #7). Conteo por schema en la tabla resumen de [09-TRAZABILIDAD.md §3](09-TRAZABILIDAD.md).

## 1. Schema `identity`

### 1.1 `users`

- **Propósito**: representar a un actor humano con credenciales de acceso a la Plataforma.
- **Agregado propietario**: `User` (Aggregate Root).
- **Responsabilidad**: única fuente de verdad de credenciales, estado habilitado/deshabilitado y pertenencia a `Company`/`Branch`.
- **Ciclo de vida**: alta → activo/deshabilitado, indefinidamente. No se elimina físicamente por caso de uso ordinario ([model/03-ENTITIES.md §1.1](../model/03-ENTITIES.md)) — una baja real es un proceso administrativo fuera de alcance de este modelo.
- **Relaciones conceptuales**: pertenece a una `company` (organization); referencia N `roles` vía `user_roles`; es referenciado (por ID opaco, cross-schema) desde `reservations.inspections.inspected_by`, `vehicles.maintenance_records` (responsable), `support.audit_log.actor_ref`.

### 1.2 `roles`

- **Propósito**: agrupar permisos con nombre, asignable a `users`.
- **Agregado propietario**: `Role`.
- **Responsabilidad**: conjunto válido y consistente de permisos; distinguir alcance `System` (global, de solo lectura) de `Custom` (propio de una `Company`, editable).
- **Ciclo de vida**: alta → activo indefinidamente (`Custom` puede desactivarse; `System` nunca se elimina ni edita).
- **Relaciones conceptuales**: referenciado por `users` vía `user_roles`; no referencia a `users` (unidireccional, [model/03-ENTITIES.md §1.2](../model/03-ENTITIES.md)).

### 1.3 `user_roles`

- **Propósito**: tabla de unión que materializa `User.roles: RoleId[]` — una lista de referencias, nunca una copia del contenido del rol ([model/02-AGGREGATES.md §1](../model/02-AGGREGATES.md)).
- **Agregado propietario**: parte del agregado `User` (el propio `User` es quien decide qué roles tiene asignados; `Role` no conoce esta tabla).
- **Responsabilidad**: registrar la asignación de un `Role` a un `User`, sin duplicar el conjunto de permisos.
- **Ciclo de vida**: alta (asignación) / baja (revocación) — sin estado propio, es una relación pura.
- **Relaciones conceptuales**: una fila por cada par `(user, role)` vigente.

### 1.4 `sessions`

- **Propósito**: representar el ciclo de vida de una sesión autenticada (par access/refresh token).
- **Agregado propietario**: `Session`.
- **Responsabilidad**: rotación de un solo uso del refresh token, revocación explícita, y detección de reutilización (robo de token).
- **Ciclo de vida**: alta (login) → rotada (refresh) | revocada (logout, cambio de contraseña, robo detectado) — ambas terminales, [model/08-STATE_MACHINES.md §6.2](../model/08-STATE_MACHINES.md).
- **Relaciones conceptuales**: pertenece a un `user`; es hoja del grafo de dominio, ningún otro agregado la referencia ([model/03-ENTITIES.md §1.3](../model/03-ENTITIES.md)).

## 2. Schema `organization`

### 2.1 `companies`

- **Propósito**: representar a la empresa cliente de la Plataforma — el tenant.
- **Agregado propietario**: `Company`.
- **Responsabilidad**: identidad fundacional (razón social, identificación fiscal) y estado de cuenta comercial con la Plataforma.
- **Ciclo de vida**: alta → activa ↔ suspendida (impago de suscripción SaaS) → baja (proceso administrativo fuera de alcance).
- **Relaciones conceptuales**: raíz de referencia (`company_id`) de prácticamente toda otra tabla de la Plataforma, sin contener esas relaciones dentro de su propia fila — son referencias inversas por convención de columna, nunca navegación de objeto ([model/03-ENTITIES.md §2.1](../model/03-ENTITIES.md)).

### 2.2 `branches`

- **Propósito**: representar una sucursal operativa de una `Company`.
- **Agregado propietario**: `Branch`.
- **Responsabilidad**: datos propios de la sucursal (dirección, horario) y ancla de scoping físico para `vehicles`.
- **Ciclo de vida**: alta → activa ↔ cerrada.
- **Relaciones conceptuales**: pertenece a exactamente una `company` (inmutable tras creación); es referenciada por `vehicles.branch_id` (cross-schema, sin FK — ver [03-RELACIONES.md](03-RELACIONES.md)) y consultada por `reservations` vía puerto síncrono al hacer check-out/check-in.

### 2.3 `company_settings`

- **Propósito**: centralizar toda la política de negocio configurable por `Company`.
- **Agregado propietario**: `CompanySettings`.
- **Responsabilidad**: única fuente de verdad de las políticas listadas en [model/02-AGGREGATES.md §6](../model/02-AGGREGATES.md) (cancelación, garantía, tardanza, mantenimiento, métodos de pago, expiración de `Draft`, antelación mínima, canal de notificación, módulos de producto habilitados).
- **Ciclo de vida**: creada junto con `Company` (valores por defecto de Plataforma), editada indefinidamente, nunca eliminada mientras la `Company` exista.
- **Relaciones conceptuales**: identidad 1:1 con `companies` (no es una FK hacia un "padre" en sentido de composición jerárquica, sino una relación de configuración-de, [model/03-ENTITIES.md §2.3](../model/03-ENTITIES.md)); leída síncronamente por `reservations`, `vehicles` e `invoices` (cross-schema, sin FK).

## 3. Schema `scheduling`

### 3.1 `availability_slots`

- **Propósito**: representar un bloque de tiempo en que un recurso genérico está ocupado o bloqueado.
- **Agregado propietario**: `AvailabilitySlot`.
- **Responsabilidad**: única fuente de verdad de "¿está libre este recurso en este rango?", con desconocimiento total de qué es el recurso — nunca gana una columna que identifique un `Vehicle` por nombre de dominio (`license_plate`, `odometer`); solo `resource_type`/`resource_id` opacos ([model/01-BOUNDED_CONTEXTS.md §4.2](../model/01-BOUNDED_CONTEXTS.md)).
- **Ciclo de vida**: creado (ocupar) → liberado (terminal) — un cambio de rango siempre libera el existente y crea uno nuevo, nunca edita el rango de uno activo.
- **Relaciones conceptuales**: ninguna FK, ni siquiera lógica, hacia `vehicles`/`reservations` — la única correlación es un `reference_id` opaco que, en la práctica, es un `ReservationId`, sin que `Scheduling` lo tipe como tal.

## 4. Schema `rental`

### 4.1 `vehicle_categories`

- **Propósito**: representar la clasificación comercial de vehículos y su tarifa vigente.
- **Agregado propietario**: `VehicleCategory`.
- **Responsabilidad**: proteger que las tarifas de una categoría no se solapen en el tiempo.
- **Ciclo de vida**: alta → activa indefinidamente (no se "cierra": se deja de asociar a vehículos nuevos).
- **Relaciones conceptuales**: referenciada por `vehicles.vehicle_category_id` (mismo schema, FK); contiene internamente N `rates`.

### 4.2 `rates`

- **Propósito**: representar el precio vigente de una `VehicleCategory` en un período determinado.
- **Agregado propietario**: entidad interna de `VehicleCategory`.
- **Responsabilidad**: conservar cada tarifa histórica con su propia vigencia, para recalcular el precio de una reserva pasada con la tarifa vigente en ese momento (RN-20).
- **Ciclo de vida**: append-only — nunca se sobrescribe un `rate` existente; una tarifa nueva crea una fila nueva con su propia vigencia ([model/03-ENTITIES.md §4.2](../model/03-ENTITIES.md)).
- **Relaciones conceptuales**: pertenece a exactamente una `vehicle_category` (FK, mismo schema).

### 4.3 `vehicles`

- **Propósito**: representar una unidad de flota disponible para alquiler.
- **Agregado propietario**: `Vehicle`.
- **Responsabilidad**: ciclo de vida operativo (disponible/mantenimiento/fuera de servicio) y documentación legal vigente; única autoridad sobre su propio estado (RN-28).
- **Ciclo de vida**: ver máquina de estados completa en [model/08-STATE_MACHINES.md §2](../model/08-STATE_MACHINES.md).
- **Relaciones conceptuales**: pertenece a un `branch_id` (cross-schema, sin FK) y a una `vehicle_category` (mismo schema, FK); contiene internamente N `vehicle_documents` y N `maintenance_records`; es referenciado por `reservations.vehicle_id` (mismo schema, FK).

### 4.4 `vehicle_documents`

- **Propósito**: representar un documento legal vigente o vencido asociado al vehículo.
- **Agregado propietario**: entidad interna de `Vehicle`.
- **Responsabilidad**: preservar el histórico legal completo — renovar un documento crea uno nuevo, nunca edita el vencido.
- **Ciclo de vida**: pendiente → vigente → vencido (transición automática por fecha, [model/08-STATE_MACHINES.md §6.7](../model/08-STATE_MACHINES.md)).
- **Relaciones conceptuales**: pertenece a un `vehicle` (FK, mismo schema); referencia un `file_id` (cross-schema hacia `support.files`, sin FK).

### 4.5 `maintenance_records`

- **Propósito**: representar una intervención de mantenimiento, programada o ejecutada.
- **Agregado propietario**: entidad interna de `Vehicle`.
- **Responsabilidad**: histórico append-only de intervenciones; bloquea disponibilidad futura del vehículo desde el momento en que se programa (INV-009).
- **Ciclo de vida**: programado → en progreso → completado ([model/08-STATE_MACHINES.md §5](../model/08-STATE_MACHINES.md)); un resultado de aptitud rechazado crea un nuevo registro, nunca reabre el anterior.
- **Relaciones conceptuales**: pertenece a un `vehicle` (FK, mismo schema); referencia opcionalmente un `damage_report_id` de origen si es correctivo (FK, mismo schema, cross-aggregate).

### 4.6 `customers`

- **Propósito**: representar a la persona natural o jurídica que alquila vehículos.
- **Agregado propietario**: `Customer`.
- **Responsabilidad**: vigencia documental que habilita a un cliente y a sus conductores autorizados.
- **Ciclo de vida**: registrado → activo (documentación validada) ↔ bloqueado.
- **Relaciones conceptuales**: contiene internamente N `identity_documents` y N `additional_drivers`; es referenciado por `reservations.customer_id` (FK, mismo schema).

### 4.7 `identity_documents`

- **Propósito**: representar un documento de identidad o licencia de conducir.
- **Agregado propietario**: entidad interna de `Customer` **y** de `AdditionalDriver` (propietario polimórfico — ver [03-RELACIONES.md §5](03-RELACIONES.md) sobre cómo se modela esta doble pertenencia sin dos tablas duplicadas).
- **Responsabilidad**: preservar el histórico documental; marcar si el dato proviene de OCR sin confirmar (RN-12/INV-011).
- **Ciclo de vida**: pendiente → verificado → vencido; renovar crea un documento nuevo.
- **Relaciones conceptuales**: pertenece a exactamente un `customer` **o** a exactamente un `additional_driver` (nunca ambos); referencia un `file_id` (cross-schema, sin FK).

### 4.8 `additional_drivers`

- **Propósito**: representar a una persona autorizada a conducir sin ser el `Customer` titular.
- **Agregado propietario**: entidad interna de `Customer`.
- **Responsabilidad**: roster reutilizable de conductores autorizados de un cliente corporativo, across múltiples reservas (RN-11).
- **Ciclo de vida**: registrado → validado ↔ revocado.
- **Relaciones conceptuales**: pertenece a un `customer` (FK, mismo schema); contiene un `identity_document` propio (su licencia); es referenciado por `reservations` vía `reservation_authorized_drivers`.

### 4.9 `reservation_authorized_drivers`

- **Propósito**: tabla de unión que materializa el subconjunto de `driverId` autorizados para una `Reservation` puntual, distinto del roster completo del `Customer` ([model/02-AGGREGATES.md §11](../model/02-AGGREGATES.md)).
- **Agregado propietario**: parte del agregado `Reservation`.
- **Responsabilidad**: registrar qué `additional_driver` está autorizado para un alquiler puntual, sin duplicar los datos del conductor.
- **Ciclo de vida**: alta al confirmar/editar la reserva — sin estado propio.
- **Relaciones conceptuales**: una fila por cada par `(reservation, additional_driver)` autorizado.

### 4.10 `reservations`

- **Propósito**: representar el compromiso transaccional de un `Customer` sobre un `Vehicle` en un rango de fechas — el corazón transaccional del producto.
- **Agregado propietario**: `Reservation`.
- **Responsabilidad**: no-solapamiento, máquina de estados del ciclo de alquiler, trazabilidad de inspección física.
- **Ciclo de vida**: ver máquina de estados completa en [model/08-STATE_MACHINES.md §1](../model/08-STATE_MACHINES.md) — única tabla de negocio, junto con `invoices`, con soft delete ([04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)).
- **Relaciones conceptuales**: referencia `customer_id` y `vehicle_id` (FK, mismo schema); referencia N `additional_driver` vía `reservation_authorized_drivers`; contiene internamente N `inspections` y N `damage_reports`; es la causa (por evento, nunca por FK) de exactamente una `invoice`.

### 4.11 `inspections`

- **Propósito**: representar el registro físico de estado del vehículo en un momento del ciclo (entrega o devolución).
- **Agregado propietario**: entidad interna de `Reservation`.
- **Responsabilidad**: evidencia inmutable — una `Reservation` normalmente tiene exactamente dos (`CheckOut`, `CheckIn`).
- **Ciclo de vida**: registrada — estado único y terminal, nunca se edita.
- **Relaciones conceptuales**: pertenece a una `reservation` (FK, mismo schema); referencia el `user_id` del Operador (cross-schema, sin FK) y N `files` de fotos vía `inspection_photos`.

### 4.12 `inspection_photos`

- **Propósito**: tabla de unión entre una `Inspection` y las N fotografías (`File`) que la evidencian.
- **Agregado propietario**: parte del agregado `Reservation` (a través de `Inspection`).
- **Responsabilidad**: registrar la asociación, sin que `Inspection` conozca ningún dato de `File` más allá de su ID opaco.
- **Ciclo de vida**: alta única al registrar la inspección — append-only, coherente con la inmutabilidad de la propia `Inspection`.
- **Relaciones conceptuales**: pertenece a una `inspection` (FK, mismo schema); referencia un `file_id` (cross-schema, sin FK).

### 4.13 `damage_reports`

- **Propósito**: representar un daño detectado, con su evidencia y calificación de imputabilidad.
- **Agregado propietario**: entidad interna de `Reservation`.
- **Responsabilidad**: evidencia inmutable para cualquier disputa futura sobre daños.
- **Ciclo de vida**: registrado — terminal (lo que evoluciona es la resolución comercial derivada en Commerce, referenciando este ID, nunca este registro mismo).
- **Relaciones conceptuales**: pertenece a una `reservation` (FK, mismo schema); referencia la `inspection` que lo detectó (FK, mismo schema) y N `files` de fotos vía `damage_report_photos`; puede ser origen de un `maintenance_record` correctivo (referenciado desde `vehicles.maintenance_records`, FK cross-aggregate mismo schema).

### 4.14 `damage_report_photos`

- **Propósito**: tabla de unión entre un `DamageReport` y las N fotografías (`File`) que lo evidencian.
- **Agregado propietario**: parte del agregado `Reservation` (a través de `DamageReport`).
- **Responsabilidad**: misma que `inspection_photos`, aplicada a evidencia de daño.
- **Ciclo de vida**: alta única — append-only.
- **Relaciones conceptuales**: pertenece a un `damage_report` (FK, mismo schema); referencia un `file_id` (cross-schema, sin FK).

### 4.15 `invoices`

- **Propósito**: representar el comprobante fiscal/comercial emitido sobre una `Reservation` cerrada.
- **Agregado propietario**: `Invoice` (Bounded Context Commerce, empaquetado físico en `rental` — ver [01-SCHEMAS.md §3.1](01-SCHEMAS.md)).
- **Responsabilidad**: integridad e inmutabilidad del comprobante emitido; consolidar las líneas de cobro (`charges`).
- **Ciclo de vida**: emitida → anulada (excepcional, terminal) — segunda y última tabla de negocio con soft delete.
- **Relaciones conceptuales**: referencia `reservation_id` (FK, mismo schema, con la restricción de unicidad condicional de [05-INDICES-Y-CONSTRAINTS.md](05-INDICES-Y-CONSTRAINTS.md)) y `customer_id` (FK, mismo schema); contiene internamente N `charges`; es referenciada de forma opaca (cross-schema, sin FK) desde `commerce.payments`.

### 4.16 `price_adjustments`

- **Propósito**: representar cada ajuste individual (`Extension`, `LateReturnPenalty`, `DamagePenalty`, `FuelDifference`) que compone el `PriceBreakdown` de una `Reservation`.
- **Agregado propietario**: entidad interna de `Reservation` a efectos de persistencia — aunque el modelo de dominio clasifica `PriceAdjustment` como Value Object compuesto dentro de `PriceBreakdown` ([model/04-VALUE_OBJECTS.md §5.2](../model/04-VALUE_OBJECTS.md)), no como entidad; ver la nota de corrección de inventario en [04-COLUMNAS-CONCEPTUALES.md §9](04-COLUMNAS-CONCEPTUALES.md) sobre por qué necesita tabla propia de todos modos.
- **Responsabilidad**: preservar cada ajuste como hecho append-only individual, calculado por `PricingService` y nunca editado tras registrarse.
- **Ciclo de vida**: registrado — terminal, igual que `charges` en `Invoice`.
- **Relaciones conceptuales**: pertenece a una `reservation` (FK, mismo schema); es el homólogo, en el lenguaje de Rental Operations, de lo que `charges` representa en Commerce — nunca se lee desde `invoices`/`charges` vía `JOIN` (la traducción ocurre por evento, [03-RELACIONES.md §4](03-RELACIONES.md)).

### 4.17 `charges`

- **Propósito**: representar una línea de cobro individual dentro de una factura — la traducción (ACL) de un `PriceAdjustment` de `Reservation` al lenguaje de Commerce.
- **Agregado propietario**: entidad interna de `Invoice`.
- **Responsabilidad**: línea fiscal individualmente citable, inmutable tras la emisión de su `invoice`.
- **Ciclo de vida**: emitida — estado único y terminal, heredado del estado de su `invoice` contenedora.
- **Relaciones conceptuales**: pertenece a una `invoice` (FK, mismo schema).

## 5. Schema `commerce`

### 5.1 `payments`

- **Propósito**: representar una transacción de cobro procesada por una pasarela externa.
- **Agregado propietario**: `Payment`.
- **Responsabilidad**: máquina de estados de un intento de cobro; idempotencia frente a reintentos de red o webhooks duplicados.
- **Ciclo de vida**: ver [model/08-STATE_MACHINES.md §3](../model/08-STATE_MACHINES.md).
- **Relaciones conceptuales**: referencia de forma opaca (cross-schema, sin FK) una `invoice` o una `security_deposit` como destino del cobro — ver tratamiento polimórfico en [03-RELACIONES.md §6](03-RELACIONES.md) y [10-DECISIONES.md](10-DECISIONES.md) #4.

### 5.2 `security_deposits`

- **Propósito**: representar el monto retenido (no cobrado) como garantía frente a una `Reservation`.
- **Agregado propietario**: `SecurityDeposit`.
- **Responsabilidad**: la liberación/retención nunca excede el monto originalmente retenido; toda retención queda vinculada a una razón trazable.
- **Ciclo de vida**: retenido → resolución terminal (liberado total, retenido parcial, retenido total).
- **Relaciones conceptuales**: referencia `reservation_id` de forma opaca (cross-schema, sin FK, cardinalidad 0..1 por reserva según el diagrama de [model/03-ENTITIES.md §7](../model/03-ENTITIES.md)).

## 6. Schema `support`

### 6.1 `files`

- **Propósito**: representar un archivo almacenado (foto de vehículo, documento de cliente, PDF de factura) con su metadata.
- **Agregado propietario**: `File`.
- **Responsabilidad**: integridad referencial mínima e inmutabilidad de `storage_ref` tras la creación.
- **Ciclo de vida**: subido → eliminado (lógicamente; el contenido físico se purga por política de retención separada).
- **Relaciones conceptuales**: no referencia hacia afuera; es referenciado (siempre por ID opaco, cross-schema) desde `vehicle_documents`, `identity_documents`, `inspection_photos`, `damage_report_photos`, `invoices` (PDF).

### 6.2 `notifications`

- **Propósito**: representar el envío de un mensaje a un destinatario por un canal, como consecuencia de un evento de negocio.
- **Agregado propietario**: `Notification`.
- **Responsabilidad**: máquina de estados de entrega y política de reintento/canal alternativo (RN-34).
- **Ciclo de vida**: pendiente → enviada → entregada/fallida (con reintento interno antes de fallo terminal).
- **Relaciones conceptuales**: deliberadamente sin relación tipada fuerte hacia el agregado que la originó — solo el payload de contexto necesario para componer el mensaje ([model/03-ENTITIES.md §6.2](../model/03-ENTITIES.md)).

### 6.3 `audit_log`

- **Propósito**: registrar de forma inmutable qué actor hizo qué y cuándo.
- **Agregado propietario**: `AuditLogEntry`.
- **Responsabilidad**: append-only estricto — el agregado con menos comportamiento de todo el modelo.
- **Ciclo de vida**: creado — estado único y terminal; sin `UPDATE`/`DELETE` posible desde la aplicación (INV-024).
- **Relaciones conceptuales**: referencia de forma genérica el tipo y ID del agregado auditado (`subject_type`/`subject_id`), sin relación tipada — evita que `Audit` dependa de conocer el modelo interno de cada Bounded Context que audita.

### 6.4 `outbox_event`

- **Propósito**: garantizar entrega confiable de eventos de dominio pese a la caída del proceso entre el commit de estado y la emisión del evento ([technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md)).
- **Agregado propietario**: ninguno — mecanismo transversal de plataforma, no un agregado de negocio de ningún Bounded Context (ver [01-SCHEMAS.md §5](01-SCHEMAS.md)).
- **Responsabilidad**: registrar, en la misma transacción que el cambio de estado que lo origina, cada evento pendiente de publicación confirmada.
- **Ciclo de vida**: insertado (pendiente) → publicado (marcado con `published_at`) — nunca editado más allá de esa única marca, nunca eliminado en el camino normal (purga por retención, fuera de alcance de este documento).
- **Relaciones conceptuales**: lleva `aggregate_type`/`aggregate_id` como valor opaco, nunca FK hacia el agregado que lo originó — una fila de outbox sobrevive aunque el agregado que la originó ya no exista de la misma forma (coherente con [technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md)).

## 7. Qué NO produce una tabla propia

- **`Permission`** (VO de `Role`): catálogo versionado junto al código, no una tabla editable en runtime ([model/04-VALUE_OBJECTS.md §2](../model/04-VALUE_OBJECTS.md), [technical/07-SECURITY.md §2](../technical/07-SECURITY.md)) — `roles` almacena su conjunto de permisos vigente como columna estructurada (ver [04-COLUMNAS-CONCEPTUALES.md](04-COLUMNAS-CONCEPTUALES.md)), pero no existe una tabla `permissions`.
- **`Reports`**: sin agregados, sin tablas propias de escritura — sus proyecciones de lectura son vistas/consultas optimizadas sobre las tablas ya existentes, nunca una fuente de verdad nueva ([model/01-BOUNDED_CONTEXTS.md §3.6](../model/01-BOUNDED_CONTEXTS.md), [ADR-0007](../ADR/0007-cqrs-selectivo.md)).
- **`Proveedor de Servicios`**: tercero mayormente offline, dato de contacto libre dentro de `maintenance_records`, no un agregado ni tabla propia ([model/03-ENTITIES.md §4.5](../model/03-ENTITIES.md)).
- **`Money`, `DateRange`, `EntityId<T>`, `Email`, `PhoneNumber`** y el resto de los Value Objects: nunca producen tabla — se representan como columnas (o pares de columnas) dentro de la tabla de la entidad que los porta, ver [04-COLUMNAS-CONCEPTUALES.md §2](04-COLUMNAS-CONCEPTUALES.md).
