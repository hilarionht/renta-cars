# 04 — Value Objects

Un Value Object (VO) en este modelo se reconoce por el criterio inverso al de [03-ENTITIES.md](03-ENTITIES.md): no tiene identidad propia, dos instancias con los mismos atributos son intercambiables e indistinguibles, es inmutable (toda "modificación" es en realidad reemplazo por una nueva instancia), y se valida a sí mismo en el momento de construirse (un VO inválido no debería poder existir).

## 1. Value Objects verdaderamente universales (`shared-kernel`)

Estos son los únicos VOs compartidos directamente entre Bounded Contexts como tipos de dominio (ver [02-ARQUITECTURA.md §8](../02-ARQUITECTURA.md)). Su superficie se mantiene deliberadamente mínima — ninguno de ellos encierra una regla de negocio específica de un solo contexto.

### 1.1 `Money`

- **Qué representa**: un monto en una moneda ISO-4217 específica.
- **Por qué es VO**: `100 USD` y otro `100 USD` son el mismo valor de negocio en cualquier cálculo — no hay identidad que distinguirlos, solo cantidad y moneda.
- **Igualdad**: por valor — dos `Money` son iguales si su cantidad (en unidad mínima, p. ej. centavos) y su moneda son idénticas. `Money(100, "USD")` nunca es igual a `Money(100, "EUR")`, ni siquiera si el valor de mercado coincidiera — mezclar monedas en una operación aritmética sin conversión explícita es un error de tipo, no un caso a resolver en runtime.
- **Inmutabilidad**: total — sumar dos `Money` produce un `Money` nuevo.
- **Validaciones**: cantidad como entero en unidad mínima (nunca `float`, coherente con [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)); moneda de un catálogo ISO-4217 válido; no permite operaciones aritméticas entre monedas distintas.
- **Reutilización**: usado por `Rate`, `PriceAdjustment`, `SecurityDeposit`, `Payment`, `Charge` — es, junto con `DateRange`, el VO más reutilizado de todo el modelo, exactamente porque "una cantidad de dinero" es un concepto genuinamente idéntico en Rental, Commerce y, a futuro, en cualquier producto.

### 1.2 `DateRange`

- **Qué representa**: un par `(startDate, endDate)` con `endDate` estrictamente posterior a `startDate`.
- **Por qué es VO**: dos rangos con las mismas fechas son el mismo rango a efectos de cualquier cálculo de solapamiento o duración.
- **Igualdad**: por valor (`start` y `end` idénticos).
- **Inmutabilidad**: total — "extender" una reserva no muta el `DateRange` existente, produce uno nuevo (consistente con la regla de `AvailabilitySlot` de nunca editar un rango, [02-AGGREGATES.md §7](02-AGGREGATES.md)).
- **Validaciones**: `endDate > startDate` en el constructor — un `DateRange` inválido no puede construirse, lo cual es precisamente el mecanismo con el que se protege RN-03 al nivel más bajo posible. Expone la operación `overlaps(other: DateRange): boolean`, usada tanto por `Reservation` (conceptualmente) como por `AvailabilitySlot` (en la implementación real del invariante de no-solapamiento).
- **Reutilización**: Scheduling, Rental Operations (`Reservation`), y potencialmente `VehicleCategory.Rate.validity` — mismo concepto, "rango de tiempo válido", en tres lugares distintos.

### 1.3 `EntityId<T>`

- **Qué representa**: un identificador tipado (p. ej. `EntityId<Vehicle>`, alias `VehicleId`).
- **Por qué es VO**: el identificador en sí no tiene identidad — es un valor (un UUID) que *representa* la identidad de otra cosa. No confundir el VO `EntityId<T>` con el hecho de que la entidad que referencia sí tenga identidad.
- **Igualdad**: por valor del UUID subyacente, pero **tipada**: `EntityId<Vehicle>` y `EntityId<Customer>` con el mismo valor UUID textual nunca son iguales entre sí — el compilador los trata como tipos incompatibles. Esta es la razón de ser explícita del VO (ver [03-DOMINIO.md §3.5](../03-DOMINIO.md)): evitar la clase de bug "pasé un `customerId` donde se esperaba un `vehicleId` y compiló igual".
- **Inmutabilidad**: total.
- **Validaciones**: formato UUID v7 válido ([04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)).
- **Reutilización**: universal — todo agregado de este modelo tiene un `EntityId<T>` propio como identidad de su raíz.

### 1.4 `Email`

- **Qué representa**: una dirección de correo electrónico sintácticamente válida.
- **Por qué es VO**: dos VOs `Email` con el mismo string son el mismo valor; no hay ciclo de vida propio de "un email" separado de quien lo posee.
- **Igualdad**: por valor, normalizado (minúsculas) antes de comparar.
- **Inmutabilidad**: total — cambiar el email de un `User` reemplaza el VO, no lo edita.
- **Validaciones**: formato RFC 5322 básico en el constructor.
- **Reutilización**: `User.email`, `Customer.ContactInfo`, `BillingContact` de `Company`.

### 1.5 `PhoneNumber`

- **Qué representa**: un número telefónico, con código de país explícito (relevante para WhatsApp/SMS).
- **Por qué es VO**: mismo razonamiento que `Email`.
- **Igualdad**: por valor, en formato E.164 normalizado.
- **Inmutabilidad**: total.
- **Validaciones**: formato E.164 en el constructor.
- **Reutilización**: `Customer.ContactInfo`, `Notification.Recipient`, `DeviceContext` (opcional).

## 2. Identity & Access

| VO | Qué representa | Por qué VO (no entidad) | Igualdad | Inmutabilidad / validaciones |
|---|---|---|---|---|
| `PasswordHash` | Hash `argon2id` de una contraseña ([09-SEGURIDAD.md §3](../09-SEGURIDAD.md)) | No tiene ciclo de vida propio distinto del acto de "cambiar contraseña" (reemplazo total) | Por valor del hash | Nunca se decodifica ni compara en claro; se reemplaza completo en cada cambio |
| `PersonName` | Nombre de una persona | Dos nombres iguales son el mismo valor a efectos de negocio | Por valor | Longitud mínima; sin lógica de negocio propia |
| `UserStatus` | `Active` \| `Disabled` | Enumeración cerrada, sin historial propio (el historial de cambios vive en `Audit`, no en el VO) | Por valor | Transición controlada por el agregado `User`, no por el VO mismo |
| `Permission` | Un permiso granular del catálogo de plataforma (`reservations:create`) | Es un átomo de un catálogo de sistema versionado junto al código, no un objeto de negocio con ciclo de vida propio en runtime — ver justificación en [02-AGGREGATES.md §2](02-AGGREGATES.md) | Por valor del string canónico | Solo valores del catálogo vigente son válidos; agregar un permiso nuevo es un cambio de código, no una operación de datos |
| `RoleName` | Nombre visible de un rol | — | Por valor | Único dentro de la `Company` para roles `Custom` |
| `RoleScope` | `System` \| `Custom` | — | Por valor | Determina las reglas de edición de `Role` (§2 de [02-AGGREGATES.md](02-AGGREGATES.md)) |
| `RefreshTokenHash` | Hash del refresh token de una `Session` | Mismo razonamiento que `PasswordHash` | Por valor del hash | Se genera uno nuevo en cada rotación; el anterior nunca se reutiliza |
| `SessionStatus` | `Active` \| `Rotated` \| `Revoked` | Enumeración cerrada | Por valor | Transición unidireccional, controlada por el agregado `Session` |
| `DeviceContext` | Metadata no sensible de dispositivo/red | Snapshot inmutable en el momento de creación de la sesión, no una entidad "dispositivo" con vida propia (no se rastrea el dispositivo entre sesiones en v1.0) | Por valor | Ninguna validación de negocio, solo de formato |

## 3. Organization

| VO | Qué representa | Por qué VO | Igualdad | Inmutabilidad / validaciones |
|---|---|---|---|---|
| `LegalName` | Razón social | — | Por valor | No vacío |
| `TaxId` (nivel Company) | Identificación fiscal de la empresa cliente | Distinto del `TaxId`/`DocumentId` de `Customer` — mismo nombre de VO, contexto y validación de formato dependiente de país distintos (ver nota de reutilización abajo) | Por valor, único a nivel de Plataforma | Formato validado según país de registro |
| `BillingContact` | Datos de contacto de facturación de la suscripción SaaS | — | Por valor | Email/teléfono válidos |
| `CompanyStatus` | `Active` \| `Suspended` | Enumeración cerrada | Por valor | Transición solo por rol de super-administración de Plataforma |
| `Address` | Dirección física (de una `Branch`, o de un `Customer` si aplica) | Sin identidad propia — dos direcciones textualmente iguales son la misma dirección a efectos de negocio | Por valor | Formato mínimo; enriquecible vía `GeolocationPort` ([11-INTEGRACIONES.md §7](../11-INTEGRACIONES.md)) sin que eso la convierta en entidad |
| `OperatingHours` | Horario de atención de una `Branch` | — | Por valor | Rango horario válido por día de semana |
| `BranchStatus` | `Active` \| `Closed` | Enumeración cerrada | Por valor | — |
| `CancellationPolicy` | Ventanas de anticipación + porcentaje de penalidad (RN-26) | Es una regla de configuración reemplazada como unidad, no una entidad con historial propio de versiones (a diferencia de `Rate`, que sí necesita historial para recalcular precios pasados — aquí no existe ese requisito de negocio) | Por valor | Porcentajes entre 0-100; ventanas no solapadas ni contradictorias |
| `DepositPolicy` | Si aplica garantía y su monto/mecanismo (RN-21) | — | Por valor | Monto ≥ 0 |
| `LateReturnPolicy` | Tolerancia de gracia + tabla de tarifa por exceso (RN-15, RN-16) | — | Por valor | Tolerancia ≥ 0; tarifas ≥ 0 |
| `MaintenanceThresholdPolicy` | Umbrales de km/tiempo para mantenimiento preventivo (RN-29) | — | Por valor | Umbrales > 0 |
| `PaymentMethodsEnabled` | Conjunto de métodos de pago habilitados (RN-24) | Conjunto cerrado de valores de un catálogo, reemplazado como unidad | Por valor (igualdad de conjunto) | Al menos un método habilitado |
| `DraftExpirationPolicy` | Tiempo de expiración de una `Reservation` en `Draft` (RN-05) | — | Por valor | Duración > 0 |
| `MinimumBookingLeadTime` | Antelación mínima para reservar (RN-06) | — | Por valor | Duración ≥ 0 |
| `NotificationChannelPreference` | Canal por defecto de la `Company` (RN-33) | — | Por valor | Canal de un catálogo válido |
| `EnabledProductModules` | Conjunto de productos activos para la `Company` ([02-ARQUITECTURA.md §4.2](../02-ARQUITECTURA.md)) | Conjunto cerrado, reemplazado como unidad | Por valor (igualdad de conjunto) | No vacío |

**Nota sobre `TaxId` reutilizado en dos contextos**: el mismo nombre de VO aparece en Organization (`Company.TaxId`) y en Rental Operations (`Customer.TaxId`/`DocumentId`). Esto es intencional y no una violación de lenguaje ubicuo: son dos VOs *distintos* con el mismo patrón conceptual ("identificador fiscal/personal validado por formato de país"), cada uno propio de su Bounded Context, sin compartir implementación a través de `shared-kernel` — no se promueven a `shared-kernel` porque cada uno acumula reglas de validación específicas de su contexto (una empresa vs. una persona/empresa cliente), lo que, según el criterio de [02-ARQUITECTURA.md §8](../02-ARQUITECTURA.md), es precisamente la señal de que **no** deben vivir en el kernel compartido.

## 4. Scheduling

| VO | Qué representa | Por qué VO | Igualdad | Inmutabilidad / validaciones |
|---|---|---|---|---|
| `ResourceRef` | Referencia genérica a un recurso (`resourceType` + `resourceId` opacos) | Es, por diseño, el VO más deliberadamente "ciego" de todo el modelo — no debe validar nada específico de negocio, solo llevar dos strings | Por valor | `resourceType` no vacío; `resourceId` no vacío. Ninguna validación de que el recurso "exista" — `Scheduling` no lo sabe ni debe saberlo |
| `SlotKind` | `Booking` (con `referenceId`) \| `Blackout` (con motivo libre) | — | Por valor | `Booking` requiere `referenceId`; `Blackout` no |

`DateRange` (§1.2) se reutiliza aquí sin modificación — es el ejemplo canónico de por qué `shared-kernel` existe.

## 5. Rental Operations

### 5.1 Cuadro general

| VO | Qué representa | Por qué VO | Igualdad | Inmutabilidad / validaciones |
|---|---|---|---|---|
| `CategoryName` | Nombre comercial de categoría | — | Por valor | No vacío, único por `Company` |
| `CategoryDescription` | Descripción comercial | — | Por valor | — |
| `LicensePlate` | Placa/patente del vehículo | Formato varía por país, pero el concepto ("identificador registral legal") es un valor puro, sin ciclo de vida propio distinto del `Vehicle` que lo porta | Por valor, normalizado | Formato validado según país de la `Branch` |
| `VIN` | Número de identificación vehicular global | — | Por valor | Formato de 17 caracteres alfanuméricos (estándar ISO 3779) |
| `Odometer` | Lectura de kilometraje en un instante | Cada lectura es un valor puntual — el histórico de lecturas se preserva porque cada `Inspection` (entidad) tiene su propio `Odometer` inmutable, no porque `Odometer` en sí sea una entidad | Por valor | No puede ser menor que la última lectura registrada — validado por el agregado (`Vehicle`/`Reservation`), no por el VO en aislamiento, porque requiere conocer el historial |
| `VehicleStatus` | `Available` \| `Reserved` \| `CheckedOut` \| `Maintenance` \| `OutOfService` | Enumeración cerrada con transición gobernada por el agregado `Vehicle` (RN-28) | Por valor | Transición válida solo según [08-STATE_MACHINES.md §2](08-STATE_MACHINES.md) |
| `TaxId`/`DocumentId` (Customer) | Identificación fiscal/personal del cliente | Ver nota en §3 | Por valor | Formato dependiente de país; distinto por `CustomerType` (natural/jurídico) |
| `ContactInfo` | Email + teléfono de un `Customer` | Agregación de dos VOs universales en un VO de contexto | Por valor | Reutiliza `Email`/`PhoneNumber` |
| `CustomerType` | `Individual` \| `Corporate` | Enumeración cerrada, determina reglas de `AdditionalDriver` (RN-11) | Por valor | — |
| `CustomerBlockStatus` | `None` \| `Blocked` (con motivo) | — | Por valor | Motivo obligatorio si `Blocked` |
| `ReservationStatus` | `Draft` \| `Confirmed` \| `CheckedOut` \| `CheckedIn` \| `Closed` \| `Cancelled` | Enumeración cerrada, la más crítica de este BC | Por valor | Transición válida solo según [08-STATE_MACHINES.md §1](08-STATE_MACHINES.md) |

### 5.2 `PriceBreakdown` y `PriceAdjustment` (tratamiento extendido)

- **Qué representan**: `PriceBreakdown` es el desglose completo del monto de una `Reservation` — un `baseAmount: Money` (tarifa acordada) más una lista de `PriceAdjustment`. Cada `PriceAdjustment` es un ajuste con `kind` (`Extension`, `LateReturnPenalty`, `DamagePenalty`, `FuelDifference`), `amount: Money` y `reason` descriptivo.
- **Por qué son VO y no entidades**: aunque cada ajuste "ocurre" en un momento distinto de la vida de la reserva, ninguno tiene ciclo de vida propio tras registrarse — no se edita, no transiciona de estado, no se referencia individualmente desde fuera de `Reservation`. Es una lista append-only de hechos inmutables, el caso de manual de VO compuesto.
- **Igualdad**: por valor de todos sus campos — dos `PriceAdjustment` con el mismo `kind`, `amount` y `reason` son intercambiables (aunque en la práctica cada uno se genera en un momento distinto y por tanto rara vez coinciden exactamente, la igualdad estructural sigue siendo la regla).
- **Inmutabilidad**: total — `PriceBreakdown` se reemplaza como unidad cada vez que se agrega un ajuste (el agregado `Reservation` expone `applyAdjustment(adjustment: PriceAdjustment)`, que internamente produce un `PriceBreakdown` nuevo).
- **Validaciones**: `amount` siempre en la misma moneda que `baseAmount`; `kind` de un catálogo cerrado propio de Rental Operations.
- **Reutilización y frontera de lenguaje**: **no** se reutiliza en Commerce. Es, deliberadamente, el homólogo en el lenguaje de Rental Operations de lo que Commerce llama `Charge`/`Penalty` — ver la Anti-Corruption Layer descrita en [01-BOUNDED_CONTEXTS.md §4.3](01-BOUNDED_CONTEXTS.md). Esta decisión de nombrar distinto el mismo tipo de hecho en dos contextos es exactamente lo que exige la disciplina de lenguaje ubicuo de [domain/02-LENGUAJE-UBICUO.md §10](../domain/02-LENGUAJE-UBICUO.md): `Charge` y `Penalty` están asignados formalmente al contexto Commerce en el glosario oficial, por lo que Rental Operations no puede reutilizar esos nombres para un concepto propio, aunque esté relacionado.

## 6. Commerce

| VO | Qué representa | Por qué VO | Igualdad | Inmutabilidad / validaciones |
|---|---|---|---|---|
| `PaymentMethod` | Tarjeta, efectivo, transferencia, billetera digital | Enumeración cerrada de un catálogo configurable por `Company` (RN-24) | Por valor | Debe pertenecer al `PaymentMethodsEnabled` vigente de la `Company` |
| `PaymentStatus` | `Requested` \| `Authorized` \| `Captured` \| `Failed` \| `Refunded` | Enumeración cerrada | Por valor | Transición válida solo según [08-STATE_MACHINES.md §3](08-STATE_MACHINES.md) |
| `GatewayReference` | Identificador opaco de la transacción en la pasarela externa | El dominio no interpreta su estructura interna, solo lo conserva para correlación | Por valor | No vacío una vez asignado por el adaptador |
| `IdempotencyKey` | Clave de deduplicación de una operación de cobro ([08-API-CONTRACTS.md §7](../08-API-CONTRACTS.md)) | — | Por valor | Única por `Payment`; su reutilización deduplica, nunca reprocesa |
| `DepositStatus` | `Held` \| `ReleasedFully` \| `RetainedPartially` \| `RetainedFully` | Enumeración cerrada, terminal en tres de sus cuatro valores | Por valor | Transición válida solo según [02-AGGREGATES.md §12](02-AGGREGATES.md) |
| `GatewayHoldReference` | Referencia opaca a una preautorización de tarjeta | — | Por valor | Solo presente si el mecanismo de garantía usa preautorización |
| `InvoiceNumber` | Numeración fiscal correlativa (RN-23) | El número en sí es un valor cuya validez depende de la secuencia, pero el VO mismo no tiene identidad propia distinta del número | Por valor | Formato dependiente de país; correlativo sin huecos dentro de su serie |
| `TaxDetails` | Impuestos aplicados a una `Invoice` | — | Por valor | Reglas de cálculo dependientes de país ([domain/03-PROCESOS.md §9](../domain/03-PROCESOS.md)) |
| `InvoiceStatus` | `Issued` \| `Voided` | Enumeración cerrada | Por valor | Transición única y terminal |

## 7. Support

| VO | Qué representa | Por qué VO | Igualdad | Inmutabilidad / validaciones |
|---|---|---|---|---|
| `StorageRef` | Puntero opaco al objeto en el proveedor de storage | El dominio nunca genera URLs directamente ([11-INTEGRACIONES.md §11](../11-INTEGRACIONES.md)) | Por valor | Inmutable tras la creación del `File` |
| `ContentType` | Tipo MIME del archivo | — | Por valor | De una lista de tipos aceptados por el módulo consumidor |
| `UploadStatus` | `Uploaded` \| `Deleted` | Enumeración cerrada | Por valor | — |
| `Channel` | `WhatsApp` \| `Email` \| `SMS` \| `Push` | Enumeración cerrada | Por valor | — |
| `Recipient` | Destinatario de una `Notification` (email o teléfono, según canal) | Reutiliza `Email`/`PhoneNumber` de `shared-kernel` | Por valor | Coherente con el `Channel` elegido |
| `NotificationStatus` | `Pending` \| `Sent` \| `Delivered` \| `Failed` | Enumeración cerrada | Por valor | Transición válida solo según [02-AGGREGATES.md §16](02-AGGREGATES.md) |
| `NotificationKind` | `Confirmation` \| `Reminder` \| `Receipt` \| `Alert` | Enumeración cerrada, ya fijada en [domain/02-LENGUAJE-UBICUO.md §8](../domain/02-LENGUAJE-UBICUO.md) | Por valor | — |
| `ActorRef` | Referencia genérica a quien ejecutó una acción auditada | Deliberadamente débil (puede ser un `UserId` o un identificador de actor de sistema como string) para que `Audit` no dependa del modelo de `Identity & Access` | Por valor | No vacío |
| `Action` | Nombre del evento/comando auditado | — | Por valor | Debe coincidir con un evento de dominio documentado en [06-DOMAIN_EVENTS.md](06-DOMAIN_EVENTS.md) |
| `Subject` | Tipo + ID del agregado afectado | Igual de deliberadamente débil que `ActorRef` | Por valor | — |
| `Timestamp` | Instante del hecho auditado | — | Por valor | Siempre `timestamptz` ([04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)) |
| `Payload` | Snapshot mínimo relevante del hecho | Estructuralmente abierto (JSON), pero tratado como valor inmutable una vez registrado | Por valor (comparación estructural, raramente usada en la práctica) | No debe contener el agregado completo, solo los campos relevantes para auditoría |

## 8. Reglas generales de reutilización de Value Objects

1. Un VO solo se promueve a `shared-kernel` cuando es **universal sin excepción** y **no acumula reglas de negocio propias de un contexto** — el criterio ya fijado en [02-ARQUITECTURA.md §8](../02-ARQUITECTURA.md), reafirmado en cada entrada de este documento donde aplicó (p. ej. `TaxId` explícitamente **no** se promueve, §3).
2. Dos VOs con el mismo nombre en Bounded Contexts distintos (`TaxId`, y en menor medida el uso coloquial de "Penalty"/`PriceAdjustment`) no son un error de este modelo — son homónimos deliberados cuando el glosario oficial ([domain/02-LENGUAJE-UBICUO.md](../domain/02-LENGUAJE-UBICUO.md)) asigna el término a un contexto distinto del que lo necesita conceptualmente. La regla operativa: si el glosario ya reservó el nombre para otro contexto, el nuevo VO recibe un nombre distinto dentro de su propio contexto (`PriceAdjustment`, no `Penalty`), documentando la equivalencia conceptual, nunca reutilizando el nombre reservado.
3. Ningún VO de este documento contiene lógica de acceso a infraestructura (formateo de UI, persistencia) — su única responsabilidad es autovalidarse y ofrecer las operaciones de negocio que su valor permite (`Money.add`, `DateRange.overlaps`), coherente con la regla de que `domain/` no conoce Prisma ni HTTP ([05-CONVENCIONES-BACKEND.md §3](../05-CONVENCIONES-BACKEND.md)).
