# 05 — Domain Services

Un Domain Service se justifica en este modelo únicamente cuando una regla de negocio real **no tiene un dueño natural entre los agregados existentes** — ni porque involucra colaboración entre agregados de Bounded Contexts distintos, ni porque opera sobre una colección de instancias de un agregado en lugar de una sola. Fuera de esos dos casos, la regla pertenece a un agregado o a un Value Object (ver [ADR-0002](../ADR/0002-ddd-pragmatico.md): "no mover reglas del dominio hacia servicios innecesariamente").

Este modelo define **tres** Domain Services. La brevedad de esta lista es deliberada: cada candidato adicional considerado durante el modelado se documenta en §4 junto con la razón por la que se descartó, para que un futuro desarrollador no reintroduzca el mismo servicio sin revisar por qué no existe.

## 1. `AvailabilityService` (Rental Operations)

**Por qué NO pertenece a una entidad**: determinar si un `Vehicle` está libre en un `DateRange` requiere combinar el estado estructural de `Vehicle` (¿está en `Maintenance`/`OutOfService`?) con el resultado de `Scheduling`, un Bounded Context distinto (¿hay un `AvailabilitySlot` que lo ocupe en ese rango?). Ningún agregado de Rental Operations puede resolver esto por sí solo: `Vehicle` no conoce `AvailabilitySlot`, y `Reservation` no puede consultar `Scheduling` directamente sin una traducción. Es, además, la Anti-Corruption Layer formal entre `Rental Operations` y `Scheduling` ya identificada en [01-BOUNDED_CONTEXTS.md §4.2](01-BOUNDED_CONTEXTS.md).

**Responsabilidad**: responder si un `Vehicle` puede aceptar una `Reservation` (nueva, extendida, o reprogramada) en un `DateRange` dado, y traducir esa decisión hacia la ocupación/liberación del `AvailabilitySlot` correspondiente cuando la decisión de negocio ya fue tomada por `Reservation`.

**Entradas**:
- `VehicleId`, `DateRange` solicitado.
- Estado estructural del `Vehicle` (vía `VehicleRepository`, dentro del mismo Bounded Context).
- Estado de ocupación del recurso (vía `CalendarPort`, publicado por Scheduling).

**Salidas**:
- `isAvailable(vehicleId, range): boolean` — usada al cotizar y al confirmar (con re-verificación obligatoria entre ambos momentos, ver [domain/03-PROCESOS.md §3](../domain/03-PROCESOS.md)).
- `reserve(vehicleId, range, reservationId): void` — traduce a `CalendarPort.occupy(resourceType="vehicle", resourceId=vehicleId, range, referenceId=reservationId)`.
- `release(vehicleId, range): void` — traduce a `CalendarPort.release(...)`.

**Reglas**:
- Un `Vehicle` en `Maintenance`/`OutOfService` es "no disponible" incluso si `Scheduling` no tiene ningún `AvailabilitySlot` activo para él (RN-04) — el servicio combina ambas fuentes, ninguna por sí sola basta.
- Nunca escribe directamente en `AvailabilitySlot` fuera de `CalendarPort` — no conoce ni debe conocer la implementación de Scheduling, solo su contrato.
- Se invoca siempre dos veces en el flujo de confirmación (al cotizar y al confirmar) por diseño explícito de negocio, nunca cacheado entre ambas llamadas.

**Dónde vive**: `application/` de `reservations` — no en `domain/` puro, porque coordina un puerto hacia otro Bounded Context (ver [03-DOMINIO.md §3.4](../03-DOMINIO.md), que ya fija esta ubicación).

## 2. `PricingService` (Rental Operations)

**Por qué NO pertenece a una entidad**: el monto total de una reserva depende de `VehicleCategory.Rate` (otro agregado), de `CompanySettings` (otro agregado, en otro Bounded Context) y de hechos propios de la `Reservation` (duración, extensión, tardanza, diferencia de combustible). Ninguna de esas tres fuentes es dueña exclusiva del cálculo — el precio es, por definición, una función de varios agregados, el caso de manual de Domain Service según Evans.

**Responsabilidad**: calcular cualquier `Money` derivado de una regla de precio de alquiler: el precio base al confirmar, el recálculo al extender o reprogramar, y el monto de penalidad por devolución tardía o diferencia de combustible.

**Entradas**:
- `VehicleCategoryId`, `DateRange` (para precio base/recálculo) → consulta `Rate` vigente en `VehicleCategory` a la fecha de cálculo (RN-20: la `Rate` vigente al momento de confirmar, no de la cotización inicial).
- `LateReturnPolicy` y `FuelPolicy`-equivalente desde `CompanySettings` (vía puerto síncrono de Organization) + los hechos registrados en la `Inspection` de check-in de la `Reservation` (horas de exceso, diferencia de combustible).

**Salidas**:
- `calculateBasePrice(categoryId, range): Money`.
- `recalculateForExtension(categoryId, newRange): Money`.
- `calculateLateReturnPenalty(actualReturn, scheduledReturn, policy): Money`.
- `calculateFuelDifferenceCharge(fuelAtCheckOut, fuelAtCheckIn, policy): Money`.

Cada salida se entrega como un `PriceAdjustment` (VO, ver [04-VALUE_OBJECTS.md §5.2](04-VALUE_OBJECTS.md)) listo para que `Reservation` lo incorpore a su `PriceBreakdown` — el servicio nunca muta `Reservation` directamente, solo calcula y retorna un valor.

**Reglas**:
- La `Rate` usada es siempre la vigente en la fecha de confirmación, congelada desde ese momento — una edición posterior de `Rate` (una tarifa futura nueva) nunca recalcula reservas ya confirmadas.
- El cálculo de penalidad por tardanza aplica la tolerancia de gracia (RN-16) antes de generar cualquier monto — dentro de la tolerancia, el resultado es `Money(0)`, no la ausencia de un `PriceAdjustment`.
- Nunca decide **si** corresponde aplicar una penalidad por daño más allá del monto (esa decisión de imputabilidad es humana — ver §4.3 sobre por qué no existe un `DamageAssessmentService`); solo calcula el monto una vez que `Reservation`/el Operador ya determinó que corresponde.

**Dónde vive**: `application/` de `reservations` (coordina `VehicleCategory` y `CompanySettings`, dos agregados de dos Bounded Contexts) o, si su implementación no requiere I/O adicional más allá de los datos ya cargados por el caso de uso, puede residir en `domain/services/` recibiendo los VOs de política ya resueltos como parámetros — la decisión concreta de capa se deja a la implementación siempre que respete la regla de que `domain/` no invoque puertos directamente (ver [05-CONVENCIONES-BACKEND.md §3](../05-CONVENCIONES-BACKEND.md)).

## 3. `SessionSecurityService` (Identity & Access)

**Por qué NO pertenece a una entidad**: la detección de robo de refresh token (reutilización de un token ya rotado) obliga a revocar **todas** las `Session` activas de un `User`, no solo la instancia afectada — una operación sobre una colección de agregados, no sobre uno solo. Ninguna instancia individual de `Session` puede, por definición, revocar a sus hermanas.

**Responsabilidad**: ejecutar la rotación de un refresh token y, cuando detecta reutilización de un token ya rotado, revocar todas las `Session` del `User` afectado y señalar el evento de seguridad correspondiente.

**Entradas**: `RefreshTokenHash` presentado, `UserId` propietario, el conjunto de `Session` activas de ese `User` (vía `SessionRepository`).

**Salidas**:
- `rotate(presentedTokenHash): Session` (nueva sesión activa, la anterior pasa a `Rotated`) — camino normal.
- `revokeAllForUser(userId, reason): void` — camino de detección de robo, produce `SessionTheftDetected.v1`.

**Reglas**:
- Un `RefreshTokenHash` que corresponde a una `Session` ya en estado `Rotated` (no `Active`) dispara siempre el camino de robo, sin excepción ni reintento — ver [09-SEGURIDAD.md §1](../09-SEGURIDAD.md) y [ADR-0008](../ADR/0008-autenticacion-jwt-refresh.md).
- La revocación masiva es atómica respecto al conjunto de `Session` del `User` afectado — no puede quedar una sesión "olvidada" activa tras una detección de robo.

**Dónde vive**: `domain/services/` de `identity` — no depende de ningún Bounded Context externo, solo orquesta múltiples instancias de su propio agregado (`Session`), por lo que sí puede vivir en `domain/` puro, a diferencia de `AvailabilityService`/`PricingService`.

## 4. Candidatos evaluados y descartados

Se documentan explícitamente para que un futuro desarrollador entienda que la ausencia es una decisión, no un olvido — coherente con el principio rector de [00-VISION.md §5](../00-VISION.md): "¿estamos resolviendo un problema real, o uno hipotético?".

### 4.1 `MaintenanceSchedulingService`

**Candidato**: un servicio que evalúe si un `Vehicle` cruzó su umbral de mantenimiento preventivo (`MaintenanceThresholdPolicy` de `CompanySettings` vs. `Odometer`/tiempo transcurrido de `Vehicle`).

**Por qué se descartó**: aunque combina datos de dos agregados (`Vehicle` y `CompanySettings`), la lógica en sí — comparar un valor propio contra un umbral recibido como parámetro — no requiere coordinar *comportamiento* de ambos agregados, solo *un dato* de configuración que puede pasarse como parámetro. Se modela como un método del propio agregado `Vehicle` (`evaluatePreventiveMaintenanceDue(policy: MaintenanceThresholdPolicy): boolean`), invocado por un job periódico de aplicación que primero lee la política vigente. Introducir un servicio aquí sería una capa de indirección sin invariante adicional que proteger.

### 4.2 `VehicleSwapEligibilityService`

**Candidato**: un servicio dedicado a evaluar si un cambio de vehículo (Vehicle Swap) es viable.

**Por qué se descartó**: la operación se resuelve componiendo los dos servicios ya existentes (`AvailabilityService` para el nuevo vehículo, `PricingService` si cambia de categoría) desde el Command Handler de aplicación (`SwapVehicleHandler`) que invoca `Reservation.swapVehicle(...)`. No hay una regla de negocio adicional en el "swap" en sí que no sea ya la composición de disponibilidad + precio + la transición de estado que el propio agregado `Reservation` protege — crear un tercer servicio solo para nombrar esa composición sería indirección sin valor.

### 4.3 `DamageAssessmentService`

**Candidato**: un servicio que decida automáticamente la severidad de un daño y si es imputable al `Customer`.

**Por qué se descartó**: el propio descubrimiento de negocio es explícito en que esta es una **decisión humana caso a caso, no automatizable en su totalidad** ([domain/07-EXCEPCIONES.md §2](../domain/07-EXCEPCIONES.md)). Modelar un servicio de dominio para una decisión que el negocio declara no-computable sería inventar una regla que no existe. Lo que sí es computable (el monto una vez decidida la imputabilidad) ya vive en `PricingService`. Si en el futuro se introduce clasificación automática de daños por visión artificial ([domain/09-FUTURAS-CAPACIDADES.md §1](../domain/09-FUTURAS-CAPACIDADES.md)), esta seguiría siendo una *sugerencia* de apoyo (como el OCR, RN-12), nunca la fuente de verdad — no cambiaría esta decisión de modelado, solo agregaría un puerto de apoyo consultado por el Operador humano.

### 4.4 `InvoiceTranslationService` (traducción Reservation → Invoice)

**Candidato**: un servicio de dominio que traduzca `PriceAdjustment` (Rental Operations) a `Charge` (Commerce).

**Por qué se descartó como Domain Service**: la traducción es un mapeo estructural 1:1 por tipo (`kind` a `kind`), sin ninguna regla de negocio propia más allá de la correspondencia — no protege ningún invariante, no calcula nada. Es responsabilidad de la capa de aplicación (el `Listener` de `Invoices` que reacciona a `ReservationCheckedIn.v1`, ver [01-BOUNDED_CONTEXTS.md §4.3](01-BOUNDED_CONTEXTS.md)), no del dominio — coherente con la regla de que un Domain Service existe para encapsular *lógica*, no para nombrar un *mapeo* de DTOs entre capas.

### 4.5 `PaymentReconciliationService` ("¿está pagada esta factura?")

**Candidato**: un servicio que combine `Payment` e `Invoice` para determinar si una factura está saldada.

**Por qué se descartó como Domain Service**: es una pregunta de **lectura agregada**, no una operación que mute estado ni proteja un invariante de escritura — encaja exactamente en el lado Query de la separación conceptual Command/Query ya fijada en [ADR-0007](../ADR/0007-cqrs-selectivo.md). Se resuelve como una proyección de lectura en `application/`/`infrastructure/` (un `Query Handler` que lee `Payment` e `Invoice` vía Prisma), nunca como un Domain Service de escritura.

### 4.6 Un servicio genérico "de autorización de módulo por tenant"

**Candidato**: un servicio que valide si una `Company` tiene un producto (`Rental`, futuro `Workshop`) habilitado antes de ejecutar cualquier caso de uso.

**Por qué se descartó como Domain Service**: es, por diseño ya fijado en [02-ARQUITECTURA.md §4.2](../02-ARQUITECTURA.md), un guard/middleware de aplicación transversal — no una regla de dominio de ningún Bounded Context específico. Modelarlo como Domain Service de, por ejemplo, `Organization`, obligaría a ese Bounded Context a conocer el catálogo de productos de todos los productos futuros, exactamente el acoplamiento inverso que [00-VISION.md §1](../00-VISION.md) prohíbe.
