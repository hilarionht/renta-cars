# 09 — Trazabilidad de Contratos

Matriz de verificación final de esta fase: para cada uno de los 17 Aggregate Roots de [model/02-AGGREGATES.md](../model/02-AGGREGATES.md), traza su cadena completa **Aggregate → Recurso(s) público(s) → Eventos → Integraciones que intervienen → Consumidores**. Es al nivel de contratos lo que [persistence/09-TRAZABILIDAD.md](../persistence/09-TRAZABILIDAD.md) ya es al nivel físico — mismo propósito: confirmar que ningún agregado del modelo de dominio quedó sin contrato de comunicación, y que ningún contrato de este directorio existe sin un agregado que lo origine.

**Cómo leer cada fila**: "Recurso" es el nombre público de [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md); "Eventos" son los publicados según [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md); "Integraciones" son los puertos de [05-INTEGRATION-CONTRACTS.md](05-INTEGRATION-CONTRACTS.md) que intervienen en algún caso de uso del agregado; "Consumidores" resume quién consume cada superficie (Frontend, otro Bounded Context interno, o un futuro consumidor externo vía Webhook).

## 1. Identity & Access

| Aggregate | Recurso | Eventos publicados | Integraciones | Consumidores |
|---|---|---|---|---|
| `User` | `users` | `UserCreated.v1`, `UserDisabled.v1`, `UserPasswordChanged.v1` | — | `web-admin`/`mobile` (autogestión), Support (Audit, Notifications — bienvenida) |
| `Role` | `roles`, `permissions` (catálogo) | `RoleCreated.v1`, `RolePermissionsChanged.v1` | — | `web-admin` (administración de roles), Support (Audit) |
| `Session` | `sessions`, acción `auth` | `SessionCreated.v1`, `SessionRevoked.v1`, `SessionTheftDetected.v1` | — | `web-admin`/`mobile` (flujo de auth), Support (Audit) |

## 2. Organization

| Aggregate | Recurso | Eventos publicados | Integraciones | Consumidores |
|---|---|---|---|---|
| `Company` | `companies` | `CompanyRegistered.v1`, `CompanySuspended.v1` | — | `web-admin` (datos propios), `platform-admin` (suspensión cross-tenant), Support (Audit, Notifications) |
| `Branch` | `branches` | `BranchOpened.v1`, `BranchClosed.v1` | `GeolocationPort` (geocodificación de dirección) | `web-admin` (administración), Rental Operations (consulta síncrona de estado vía `BranchStatusPort`, [model/09-DEPENDENCIES.md §2](../model/09-DEPENDENCIES.md)) |
| `CompanySettings` | `company-settings` | `CompanySettingsUpdated.v1` | — | `web-admin` (configuración), Rental Operations/Commerce (lectura síncrona de política), Support (Audit) |

## 3. Scheduling

| Aggregate | Recurso | Eventos publicados | Integraciones | Consumidores |
|---|---|---|---|---|
| `AvailabilitySlot` | `availability` (consulta agregada; sin CRUD público, §3 de [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md)) | `AvailabilitySlotCreated.v1`, `AvailabilitySlotReleased.v1` | — | Rental Operations (vía `AvailabilityService`/ACL, nunca directo), Support (Audit) |

## 4. Rental Operations

| Aggregate | Recurso | Eventos publicados | Integraciones | Consumidores |
|---|---|---|---|---|
| `VehicleCategory` | `vehicle-categories`, sub-recurso `rates` | `VehicleCategoryCreated.v1`, `RateChanged.v1` | — | `web-admin` (catálogo comercial), `web-admin`/`mobile` (cotización), Reports |
| `Vehicle` | `vehicles`, sub-recursos `documents`/`maintenance-records` | `VehicleRegistered.v1`, `VehicleDocumentationLoaded.v1`, `VehicleEnabled.v1`, `VehicleStatusChanged.v1`, `MaintenanceScheduled.v1`, `MaintenanceCompleted.v1` | `StorageProviderPort` (documentos/fotos) | `web-admin` (operación de flota), Scheduling (informativo), Reports |
| `Customer` | `customers`, sub-recursos `identity-documents`/`additional-drivers` | `CustomerRegistered.v1`, `CustomerDocumentValidated.v1`, `CustomerDocumentExpired.v1`, `AdditionalDriverRegistered.v1`, `CustomerBlocked.v1`, `CustomerUnblocked.v1` | `StorageProviderPort`, `DocumentExtractionPort` (OCR) | `web-admin`/`mobile` (autogestión y registro asistido), Support (Notifications) |
| `Reservation` | `reservations`, sub-recursos `inspections`/`damage-reports` | `ReservationCreated.v1`, `ReservationConfirmed.v1`, `ReservationRejectedByAvailability.v1`, `ReservationCancelled.v1`, `ReservationCheckedOut.v1`, `ReservationRescheduled.v1`, `ExtensionRequested.v1`, `ExtensionApproved.v1`, `VehicleSwapped.v1`, `ReservationCheckedIn.v1`, `NoShowRegistered.v1`, `ReservationClosed.v1` | `StorageProviderPort` (fotos de inspección), `DocumentSigningPort` (contrato) | `web-admin`/`mobile` (ciclo completo de alquiler), Commerce (`Invoices`, `SecurityDeposit`), Support (Notifications, Reports) |

## 5. Commerce

| Aggregate | Recurso | Eventos publicados | Integraciones | Consumidores |
|---|---|---|---|---|
| `Invoice` | `invoices`, sub-recurso `charges` | `InvoiceIssued.v1`, `InvoiceVoided.v1` | `StorageProviderPort` (PDF) | `web-admin`/`mobile` (comprobantes), Commerce (`Payments`), Support (Notifications), futuro consumidor externo vía Webhook saliente (§5 de [06-WEBHOOKS.md](06-WEBHOOKS.md)) |
| `Payment` | `payments` | `PaymentSucceeded.v1`, `PaymentFailed.v1`, `PaymentRefunded.v1` | `PaymentGatewayPort` (Stripe, Mercado Pago) — incluye webhook entrante ([06-WEBHOOKS.md §1-4](06-WEBHOOKS.md)) | Commerce (`Invoices`, reconciliación), Support (Notifications, Reports) |
| `SecurityDeposit` | `security-deposits` | `SecurityDepositHeld.v1`, `SecurityDepositReleased.v1`, `SecurityDepositPartiallyRetained.v1` | `PaymentGatewayPort` (preautorización, si aplica) | `web-admin` (gestión de garantías), Support (Notifications) |

## 6. Support

| Aggregate | Recurso | Eventos publicados | Integraciones | Consumidores |
|---|---|---|---|---|
| `File` | `files` | `FileUploaded.v1`, `FileDeleted.v1` | `StorageProviderPort` | Todo Bounded Context que referencia un `fileId` (Vehicle, Customer, Reservation, Invoice) |
| `Notification` | `notifications` (solo consulta administrativa) | `NotificationSent.v1`, `NotificationDelivered.v1`, `NotificationFailed.v1` | `NotificationSenderPort` (WhatsApp, Email, SMS — incluye webhook entrante de confirmación de entrega), `PushNotificationSenderPort` | Todo Bounded Context (reactivo, vía eventos que la originan), `web-admin` (consulta de historial de envíos) |
| `AuditLogEntry` | `audit-log` (solo lectura) | Ninguno — consumidor terminal | — | `web-admin`/`platform-admin` (investigación de auditoría/seguridad) |

## 7. Reports (sin Aggregate Root)

| Recurso | Origen de datos | Consumidores |
|---|---|---|
| `reports/*` (proyecciones, catálogo abierto) | Eventos de todos los Bounded Context anteriores (`ReservationConfirmed.v1`, `PaymentSucceeded.v1`, `VehicleStatusChanged.v1`, etc. — [model/09-DEPENDENCIES.md §4](../model/09-DEPENDENCIES.md)) | `web-admin` (Administrador de Empresa, Responsable Comercial/Financiero) |

## 8. Verificación de completitud

| Chequeo | Resultado |
|---|---|
| ¿Todo Aggregate Root de [model/02-AGGREGATES.md](../model/02-AGGREGATES.md) (17) tiene al menos un recurso público o interno en [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md)? | Sí — 17/17, uno por fila de §1-§6, salvo `AvailabilitySlot` que expone únicamente una consulta agregada por diseño de ACL (§3 de [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md)), no un CRUD directo — decisión de modelado, no una omisión |
| ¿Todo evento "cruza BC" de [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md) tiene un consumidor identificado en esta matriz? | Sí — cada fila de §1-§6 lista sus consumidores; `Support`/`Audit` se omite por regla transversal ya fijada en [model/06-DOMAIN_EVENTS.md §2](../model/06-DOMAIN_EVENTS.md), heredada sin repetición |
| ¿Toda integración de [05-INTEGRATION-CONTRACTS.md](05-INTEGRATION-CONTRACTS.md) aparece asociada a al menos un agregado consumidor? | Sí — `NotificationSenderPort`/`PushNotificationSenderPort` (Notification), `StorageProviderPort` (transversal, listado en cada agregado que lo usa), `DocumentExtractionPort` (Customer), `GeolocationPort` (Branch), `PaymentGatewayPort` (Payment, SecurityDeposit), `DocumentSigningPort` (Reservation) |
| ¿Todo recurso de [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md) existe sin que esta matriz lo origine desde un agregado? | No — todos los recursos públicos/internos aparecen en §1-§7; `reports/*` no tiene agregado propio por diseño ya fijado ([model/01-BOUNDED_CONTEXTS.md §3.6](../model/01-BOUNDED_CONTEXTS.md)) |
| ¿Todo error de dominio de [07-ERROR-CATALOG.md §3](07-ERROR-CATALOG.md) es trazable a un invariante de un agregado de esta matriz? | Sí — cada `code` de esa sección referencia su invariante/RN de origen, y cada invariante pertenece a un agregado ya presente en §1-§6 |

## 9. Qué NO se decide en este documento

- El contenido exacto de cada recurso/evento/error — cada tabla remite a su documento de detalle (`02-RESOURCE-CATALOG.md`, `model/06-DOMAIN_EVENTS.md`, `07-ERROR-CATALOG.md`); esta matriz es de verificación cruzada, no la fuente de verdad de ningún contenido individual.
- El catálogo de proyecciones de `reports` — crece con la necesidad real del negocio, no se enumera exhaustivamente aquí (mismo criterio de [02-RESOURCE-CATALOG.md §7](02-RESOURCE-CATALOG.md)).
