# 07 — Invariants

Este documento consolida todas las invariantes de dominio del modelo, clasificadas en dos dimensiones ortogonales y una de criticidad heredada:

- **Alcance**: `Aggregate` (protegida enteramente dentro de un único agregado, ver [02-AGGREGATES.md](02-AGGREGATES.md)) vs. `Cross-Aggregate` (requiere colaboración entre dos o más agregados, posiblemente de Bounded Contexts distintos).
- **Dominio**: `Platform` (aplicaría igual en cualquier producto futuro sobre la Plataforma) vs. `Rental` (solo tiene sentido en el negocio de alquiler de vehículos) — mismo criterio ya fijado en [domain/08-BOUNDARY.md §1](../domain/08-BOUNDARY.md).
- **Criticidad**: 🔴 Crítica / 🟡 Importante / 🟢 Opcional — mismo esquema de [domain/05-REGLAS-NEGOCIO.md](../domain/05-REGLAS-NEGOCIO.md), extendido aquí a invariantes de Plataforma que ese catálogo no cubría (Identity, Organization, Commerce, Support).

Toda invariante marcada 🔴 tiene, además, una nota explícita de **mecanismo de protección** — porque una invariante crítica en este modelo nunca depende de un único punto de falla (ver §6).

## 1. Invariantes de agregado (Aggregate)

Ya documentadas en detalle en [02-AGGREGATES.md](02-AGGREGATES.md); esta tabla es su índice de clasificación, no una repetición de su justificación completa.

| ID | Invariante (resumen) | Agregado | Dominio | Criticidad | RN origen |
|---|---|---|---|---|---|
| INV-001 | `endDate > startDate` en todo `DateRange` | `Reservation` (vía VO `DateRange`) | Rental | 🔴 | RN-03 |
| INV-002 | Transiciones de `ReservationStatus` solo según la máquina de estados | `Reservation` | Rental | 🔴 | — |
| INV-003 | `CheckOut` exige `Inspection` completa (odómetro + combustible + fotos) | `Reservation` | Rental | 🔴 | RN-13 |
| INV-004 | `CheckIn` exige `Inspection` comparada contra la línea base de `CheckOut` | `Reservation` | Rental | 🔴 | RN-14 |
| INV-005 | `Closed` solo alcanzable después de recibir `InvoiceIssued.v1` | `Reservation` | Rental | 🔴 | RN-22 |
| INV-006 | El cambio de `VehicleStatus` es responsabilidad exclusiva de `Vehicle` | `Vehicle` | Rental | 🔴 | RN-28 |
| INV-007 | `Vehicle` no puede pasar a `Available` sin `VehicleDocument` vigente por cada tipo obligatorio | `Vehicle` | Rental | 🔴 | RN-27 |
| INV-008 | `Vehicle` pertenece exactamente a una `Branch` a la vez | `Vehicle` | Rental | 🔴 | RN-31 |
| INV-009 | `MaintenanceRecord` programado bloquea disponibilidad futura desde su creación, no solo durante la intervención | `Vehicle` | Rental | 🟡 | — |
| INV-010 | Dos `Rate` de la misma `VehicleCategory` no se solapan en vigencia | `VehicleCategory` | Rental | 🟡 | RN-20 (derivada) |
| INV-011 | Datos de `IdentityDocument` con `extractedByOcr=true` no son verdad de negocio sin confirmación humana | `Customer` | Rental | 🔴 | RN-12 |
| INV-012 | `AdditionalDriver` no puede quedar `Validated` sin licencia vigente propia | `Customer` | Rental | 🔴 | RN-09 |
| INV-013 | Dos `AvailabilitySlot` del mismo `ResourceRef` no se solapan | `AvailabilitySlot` | Platform | 🔴 | RN-02 (mecanismo genérico) |
| INV-014 | `Email` único por `CompanyId` | `User` | Platform | 🟡 | — |
| INV-015 | Reutilización de `RefreshTokenHash` ya rotado fuerza revocación total de sesiones del usuario | `Session` | Platform | 🔴 | — |
| INV-016 | `TaxId` de `Company` único a nivel de Plataforma | `Company` | Platform | 🟡 | — |
| INV-017 | `CompanySettings` no puede tener campo alguno que relaje una regla 🔴 Crítica | `CompanySettings` | Platform | 🔴 | ver [domain/05-REGLAS-NEGOCIO.md §7](../domain/05-REGLAS-NEGOCIO.md) |
| INV-018 | `EnabledProductModules` nunca vacío | `CompanySettings` | Platform | 🟡 | — |
| INV-019 | Retención total de `SecurityDeposit` nunca excede el monto retenido | `SecurityDeposit` | Platform (mecanismo) | 🔴 | RN-21 |
| INV-020 | `SecurityDeposit` resuelto (`Released`/`Retained`) es terminal | `SecurityDeposit` | Platform (mecanismo) | 🔴 | RN-21 |
| INV-021 | `Payment` con la misma `IdempotencyKey` no se procesa dos veces | `Payment` | Platform | 🔴 | — |
| INV-022 | `Charge` inmutable tras la emisión de su `Invoice` | `Invoice` | Platform (mecanismo) / Rental (contenido) | 🔴 | RN-22 (relacionada) |
| INV-023 | `Invoice` emitida una única vez por `Reservation` (salvo anulación + reemisión) | `Invoice` | Rental (origen) | 🔴 | RN-22 |
| INV-024 | `AuditLogEntry` append-only, sin `UPDATE`/`DELETE` | `AuditLogEntry` | Platform | 🔴 | — |
| INV-025 | `File` con `StorageRef` inmutable tras creación | `File` | Platform | 🟡 | — |
| INV-026 | `Role` de alcance `System` no editable ni eliminable | `Role` | Platform | 🟡 | — |

## 2. Invariantes cross-aggregate

Estas son las invariantes que ningún agregado individual puede proteger por sí solo — requieren colaboración vía puerto síncrono, evento, o una segunda capa de defensa a nivel de base de datos.

| ID | Invariante | Agregados involucrados | Mecanismo de protección | Dominio | Criticidad | RN origen |
|---|---|---|---|---|---|---|
| INV-101 | No puede confirmarse una `Reservation` si el `Vehicle` no está disponible en todo el `DateRange` | `Reservation`, `Vehicle`, `AvailabilitySlot` (Scheduling) | `AvailabilityService` (ACL) consulta estado estructural de `Vehicle` + `CalendarPort`; re-verificación obligatoria entre cotizar y confirmar | Rental | 🔴 | RN-01 |
| INV-102 | Dos `Reservation` activas no se solapan sobre el mismo `Vehicle` | `Reservation`, `AvailabilitySlot` | Doble capa: validación de aplicación vía `AvailabilityService` **+** `exclusion constraint` GiST sobre `AvailabilitySlot` a nivel de base de datos ([04-MODELO-DATOS.md §8](../04-MODELO-DATOS.md)) — la misma disciplina de defensa en profundidad que multi-tenancy | Rental | 🔴 | RN-02 |
| INV-103 | Un `Vehicle` en `Maintenance`/`OutOfService` no puede ofrecerse disponible ni completar `CheckOut` | `Vehicle`, `Reservation`, `AvailabilitySlot` | `Vehicle` es dueño del hecho (`VehicleStatusChanged.v1`); `Reservation` lo consulta antes de cada transición; `Scheduling` refleja el bloqueo vía `Blackout` | Rental | 🔴 | RN-04 |
| INV-104 | No puede confirmarse una `Reservation` si el `Customer` no es elegible (documentación vigente, no bloqueado) | `Reservation`, `Customer` | `Reservation.confirm()` consulta `CustomerLookupPort` (puerto síncrono publicado por `Customer`) antes de transicionar | Rental | 🔴 | RN-08 |
| INV-105 | Un `AdditionalDriver` no declarado/validado antes del `CheckOut` no puede conducir con cobertura válida | `Reservation`, `Customer` | `Reservation.checkOut()` valida que cada `driverId` autorizado para esa reserva referencia un `AdditionalDriver` en estado `Validated` | Rental | 🔴 | RN-09 |
| INV-106 | Una extensión que colisiona con otra `Reservation` confirmada no se aprueba silenciosamente | `Reservation` (dos instancias), `AvailabilitySlot` | `AvailabilityService` re-verifica el rango extendido; si falla, exige `VehicleSwapped` o rechazo explícito — nunca una aprobación implícita | Rental | 🔴 | RN-30 (relacionada), hotspot [domain/04-EVENT-STORMING.md §10](../domain/04-EVENT-STORMING.md) |
| INV-107 | Un `MaintenanceRecord` programado que colisiona con una `Reservation` confirmada exige resolución explícita | `Vehicle`, `Reservation` | Programar mantenimiento sobre un `Vehicle` con `Reservation` confirmada en el mismo rango dispara una excepción de aplicación que fuerza decisión humana (reprogramar mantenimiento u ofrecer swap) — nunca un solapamiento silencioso | Rental | 🔴 | RN-30 |
| INV-108 | `Reservation` no puede pasar a `Closed` sin `Invoice` emitida | `Reservation`, `Invoice` | `Reservation` reacciona a `InvoiceIssued.v1`; no existe transición directa a `Closed` sin ese evento | Rental (contenido) / Platform (mecanismo) | 🔴 | RN-22 |
| INV-109 | Un `Payment` fallido después del `CheckOut` no revierte ningún estado de `Reservation` | `Payment`, `Reservation` | `Payment` no tiene autoridad de escritura sobre `Reservation`; el fallo se traduce en gestión de cobranza (nuevo `Payment`/proceso), nunca en un comando de reversión | Rental (regla de negocio) / Platform (mecanismo) | 🔴 | RN-25 |
| INV-110 | Un `Charge` de `Invoice` corresponde 1:1 a un `PriceAdjustment` ya decidido por `Reservation` | `Reservation`, `Invoice` | Traducción ACL en el listener de `Invoices` que reacciona a `ReservationCheckedIn.v1` — `Invoice` nunca decide montos por sí misma | Rental (origen) / Platform (mecanismo) | 🟡 | — |
| INV-111 | Retención de `SecurityDeposit` exige una razón trazable (`DamageReport` o `PriceAdjustment` de penalidad) | `SecurityDeposit`, `Reservation` | `SecurityDeposit` nunca decide *que* hay daño — solo ejecuta la resolución ya tomada por `Reservation`/el Operador humano | Rental (origen) / Platform (mecanismo) | 🔴 | RN-21 |
| INV-112 | Un `Branch` en `Closed` no admite nuevos `CheckOut` | `Branch`, `Reservation` | `Reservation.checkOut()` consulta el estado de la `Branch` del `Vehicle` vía puerto síncrono de `Organization` | Platform (mecanismo) / Rental (efecto) | 🟡 | — |
| INV-113 | Ninguna política de `CompanySettings` puede relajar una regla 🔴 Crítica | `CompanySettings`, todos los agregados de Rental Operations y Commerce que leen política | Ausencia deliberada de superficie configurable — no existe campo, no es una validación en runtime (ver [02-AGGREGATES.md §6](02-AGGREGATES.md)) | Platform | 🔴 | [domain/05-REGLAS-NEGOCIO.md §7](../domain/05-REGLAS-NEGOCIO.md) |
| INV-114 | Un `User` deshabilitado no autentica nuevas `Session`, pero sus `Session` ya emitidas no se invalidan instantáneamente | `User`, `Session` | Trade-off explícito aceptado en [ADR-0008](../ADR/0008-autenticacion-jwt-refresh.md): propagación acotada a la vida del `access_token` (15 min) salvo revocación explícita de `Session` | Platform | 🟡 | — |

## 3. Invariantes de Plataforma (aplicables a cualquier producto futuro)

Estas son estructurales — no pertenecen a ningún agregado de negocio específico, sino a la disciplina arquitectónica que sostiene toda la Plataforma. Se listan aquí porque, aunque ya están fijadas en `docs/` como reglas de arquitectura, todo agregado de este modelo las hereda como precondición de existencia.

| ID | Invariante | Fuente arquitectónica | Criticidad |
|---|---|---|---|
| INV-P01 | Toda entidad de negocio no catalogada globalmente tiene `companyId` obligatorio, filtrado en dos capas (aplicación + RLS) | [ADR-0004](../ADR/0004-multitenancy.md), [04-MODELO-DATOS.md §4](../04-MODELO-DATOS.md) | 🔴 |
| INV-P02 | Ningún módulo (`platform/` o `products/`) importa `domain/`/`application/`/`infrastructure/` de otro módulo fuera de su `index.ts` público | [02-ARQUITECTURA.md §5.3](../02-ARQUITECTURA.md), [ADR-0005](../ADR/0005-comunicacion-modulos.md) | 🔴 |
| INV-P03 | `platform/*` nunca depende de `products/*` | [02-ARQUITECTURA.md §4](../02-ARQUITECTURA.md) | 🔴 |
| INV-P04 | Ninguna transacción de base de datos cruza la frontera de dos módulos | [02-ARQUITECTURA.md §5.4](../02-ARQUITECTURA.md) | 🔴 |
| INV-P05 | Todo evento de dominio lleva versión explícita (`.v1`) desde su primera publicación | [05-CONVENCIONES-BACKEND.md §11](../05-CONVENCIONES-BACKEND.md) | 🔴 |
| INV-P06 | Ninguna integración externa se invoca directamente desde `domain/` — siempre detrás de un puerto | [ADR-0010](../ADR/0010-provider-pattern-integraciones.md) | 🔴 |
| INV-P07 | Todo evento de seguridad relevante se registra en `AuditLogEntry` de forma inmutable | [09-SEGURIDAD.md §4](../09-SEGURIDAD.md) | 🔴 |

## 4. Invariantes de Rental (solo tienen sentido en el negocio de alquiler de vehículos)

Mapeo completo del catálogo original de [domain/05-REGLAS-NEGOCIO.md](../domain/05-REGLAS-NEGOCIO.md) a este modelo — cada `RN-xx` ya tiene un `INV-xxx` correspondiente en §1 o §2 de este documento; esta tabla es el índice inverso (de regla de negocio a invariante técnico) para quien llegue desde el documento de descubrimiento de negocio.

| RN | Invariante técnica correspondiente |
|---|---|
| RN-01 | INV-101 |
| RN-02 | INV-102 |
| RN-03 | INV-001 |
| RN-04 | INV-103 |
| RN-05 | Política (`DraftExpirationPolicy`), no invariante — expira por job temporal, no protege un invariante de dominio |
| RN-06 | Política (`MinimumBookingLeadTime`), no invariante |
| RN-07 | Ya resuelta como límite de agregado: `Reservation` 1:1 con `Vehicle` (ver [02-AGGREGATES.md §11](02-AGGREGATES.md)) |
| RN-08 | INV-104 |
| RN-09 | INV-105, INV-012 |
| RN-10 | Dependiente de país — modelado como validación de `IdentityDocument`/`CustomerType`, no como invariante universal de este documento |
| RN-11 | Sin invariante universal (límite contractual, si existe, es configuración) |
| RN-12 | INV-011 |
| RN-13 | INV-003 |
| RN-14 | INV-004 |
| RN-15, RN-16 | Cálculo de `PricingService` (ver [05-DOMAIN_SERVICES.md §2](05-DOMAIN_SERVICES.md)), gobernado por política, no un invariante de bloqueo |
| RN-17 | Modelado como creación de `DamageReport` — no es un invariante de bloqueo, es un efecto obligatorio de la inspección (INV-004 lo cubre indirectamente) |
| RN-18 | Cálculo de `PricingService` |
| RN-19 | Política de No-show, equivalente a RN-15/26 salvo configuración distinta |
| RN-20 | INV-010 (mecanismo de vigencia de `Rate`) |
| RN-21 | INV-019, INV-020, INV-111 |
| RN-22 | INV-005, INV-108, INV-023 |
| RN-23 | Dependiente de país — modelado en `TaxDetails`/`InvoiceNumber` (VO), no como invariante universal |
| RN-24 | Configuración (`PaymentMethodsEnabled`), no invariante |
| RN-25 | INV-109 |
| RN-26 | Configuración (`CancellationPolicy`), no invariante |
| RN-27 | INV-007 |
| RN-28 | INV-006 |
| RN-29 | Configuración (`MaintenanceThresholdPolicy`), no invariante |
| RN-30 | INV-106, INV-107 |
| RN-31 | INV-008 |
| RN-32, RN-33, RN-34 | Reglas de `Notification` (ver [02-AGGREGATES.md §16](02-AGGREGATES.md)) — importantes pero no invariantes de bloqueo de otro agregado |

## 5. Por qué algunas RN no producen un invariante técnico

Una regla de negocio configurable (🟢/🟡 y "Configurable" en [domain/05-REGLAS-NEGOCIO.md](../domain/05-REGLAS-NEGOCIO.md)) no siempre se traduce en un invariante — un invariante, en sentido DDD estricto, es algo que **nunca** puede violarse; una política configurable (ventana de cancelación, umbral de mantenimiento) es un **parámetro** que alimenta un cálculo o una decisión, no una condición de validez del agregado. Confundir ambas cosas llevaría a modelar reglas de negocio blandas como si fueran restricciones estructurales, contradiciendo directamente §7 de [domain/05-REGLAS-NEGOCIO.md](../domain/05-REGLAS-NEGOCIO.md): "ninguna configuración a nivel de Company puede relajar una regla crítica" — la contrapartida exacta de esa afirmación es que las reglas *no* críticas sí son, por diseño, relajables, y por tanto no son invariantes.

## 6. Invariantes con doble capa de defensa (defensa en profundidad)

Consistente con el principio de seguridad ya fijado en [09-SEGURIDAD.md §5](../09-SEGURIDAD.md) ("ninguna capa es sustituible por la otra"), estas invariantes 🔴 tienen protección redundante deliberada:

| Invariante | Capa 1 (aplicación/dominio) | Capa 2 (base de datos / infraestructura) |
|---|---|---|
| INV-102 (no-solapamiento de reservas) | `AvailabilityService` valida antes de confirmar | `exclusion constraint` GiST sobre `AvailabilitySlot` ([04-MODELO-DATOS.md §8](../04-MODELO-DATOS.md)) |
| INV-P01 (aislamiento multi-tenant) | Prisma Client Extension filtra `companyId` automáticamente | Row-Level Security nativo de PostgreSQL ([ADR-0004](../ADR/0004-multitenancy.md)) |
| INV-021 (idempotencia de `Payment`) | Deduplicación por `IdempotencyKey` en el caso de uso | Constraint de unicidad sobre `IdempotencyKey` a nivel de tabla |
| INV-024 (append-only de `AuditLogEntry`) | Ningún caso de uso expone `update`/`delete` | Permisos de base de datos que niegan `UPDATE`/`DELETE` sobre `support.audit_log` al rol de aplicación |

Ninguna otra invariante de este documento requiere doble capa — el resto se protege correctamente con una sola capa (el agregado correspondiente, o la validación cross-aggregate ya descrita), y agregar una segunda capa sin necesidad real violaría el principio de simplicidad activa de [00-VISION.md §3](../00-VISION.md).
