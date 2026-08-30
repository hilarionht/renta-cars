# 06 — Domain Events

Este documento es el catálogo oficial de eventos de dominio de la Plataforma, al nivel de detalle de modelado táctico. Formaliza como contrato versionado todo evento producido por los agregados de [02-AGGREGATES.md](02-AGGREGATES.md) — no solo los nueve ya fijados como contrato técnico en [03-DOMINIO.md §4](../03-DOMINIO.md), sino el catálogo completo descubierto en [domain/04-EVENT-STORMING.md](../domain/04-EVENT-STORMING.md), ahora que el modelado táctico permite decidir con precisión payload, publicador y consumidor de cada uno.

## 1. Envelope común

Todo evento de dominio, sin excepción, lleva:

```
{
  eventId: UUID,
  eventType: string,        // "ReservationConfirmed.v1"
  occurredAt: timestamptz,
  companyId: UUID,          // ausente solo en eventos verdaderamente globales de Plataforma (p. ej. CompanyRegistered.v1, donde companyId ES el sujeto)
  payload: { ... }          // específico de cada evento, ver catálogo
}
```

Esta envoltura ya está fijada en [03-DOMINIO.md §4](../03-DOMINIO.md) y se hereda sin modificación. `eventType` siempre lleva sufijo de versión (`.v1`) desde el primer día — regla no negociable ya fijada en [05-CONVENCIONES-BACKEND.md §11](../05-CONVENCIONES-BACKEND.md).

## 2. Convención de lectura del catálogo

- **Cruza BC**: si el evento tiene al menos un consumidor fuera del Bounded Context que lo publica. Solo estos eventos son, en sentido estricto, el "contrato técnico entre módulos" de [03-DOMINIO.md §4](../03-DOMINIO.md). Los que no cruzan BC igual se versionan (regla universal) pero su disciplina de compatibilidad es interna al módulo dueño.
- **Consumido por**: se omite `Audit` en cada fila por regla transversal explícita — ver §5. Se lista únicamente el/los consumidor(es) de negocio específicos.
- **Garantía**: la garantía de entrega del bus in-process, igual para todos salvo excepción indicada — ver §6.

## 3. Catálogo — Identity & Access

| Evento                          | Payload conceptual                                                                     | Publicado por                                             | Consumido por (hoy)                                                                                                                                                             | Cruza BC |
| ------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `UserCreated.v1`                | `userId`, `companyId`, `branchId?`, `email`, `roles[]`                                 | `User`                                                    | Support (Audit, Notifications — bienvenida)                                                                                                                                     | Sí       |
| `UserDisabled.v1`               | `userId`, `disabledBy`, `reason?`                                                      | `User`                                                    | Support (Audit)                                                                                                                                                                 | Sí       |
| `UserPasswordChanged.v1`        | `userId`, `changedBy`                                                                  | `User`                                                    | Support (Audit)                                                                                                                                                                 | Sí       |
| `UserMfaEnabled.v1`             | `userId`                                                                               | `User`                                                    | Support (Audit)                                                                                                                                                                 | Sí       |
| `UserMfaDisabled.v1`            | `userId`                                                                               | `User`                                                    | Support (Audit)                                                                                                                                                                 | Sí       |
| `RoleCreated.v1`                | `roleId`, `companyId`, `scope`                                                         | `Role`                                                    | Support (Audit)                                                                                                                                                                 | Sí       |
| `RolePermissionsChanged.v1`     | `roleId`, `addedPermissions[]`, `removedPermissions[]`                                 | `Role`                                                    | Support (Audit)                                                                                                                                                                 | Sí       |
| `RoleDeactivated.v1`            | `roleId`                                                                               | `Role`                                                    | Support (Audit)                                                                                                                                                                 | Sí       |
| `SessionCreated.v1`             | `sessionId`, `userId`, `deviceContext`                                                 | `Session`                                                 | Support (Audit)                                                                                                                                                                 | Sí       |
| `SessionRevoked.v1`             | `sessionId`, `userId`, `reason`                                                        | `Session`                                                 | Support (Audit)                                                                                                                                                                 | Sí       |
| `SessionTheftDetected.v1`       | `userId`, `affectedSessionIds[]`                                                       | `SessionSecurityService`                                  | Support (Audit — prioridad de seguridad, ver [09-SEGURIDAD.md §4](../09-SEGURIDAD.md))                                                                                          | Sí       |
| `LoginFailed.v1`                | `email`, `companyId?`, `reason` (`unknown_email`\|`invalid_password`\|`user_disabled`) | — (sin agregado; el intento no persiste ningún `Session`) | Support (Audit — [09-SEGURIDAD.md §4](../09-SEGURIDAD.md) exige auditar login fallido, no solo exitoso)                                                                         | Sí       |
| `MfaVerificationFailed.v1`      | `mfaChallengeId`, `userId`, `companyId`                                                | `MfaLoginChallenge`                                       | Support (Audit — mismo criterio que `LoginFailed.v1`, un 2do factor fallido es tan auditable)                                                                                   | Sí       |
| `PasswordResetTokenReplayed.v1` | `challengeId`, `userId`                                                                | `PasswordResetChallenge`                                  | Support (Audit — mismo criterio que `SessionTheftDetected.v1`: reusar un token de reset ya consumido/expirado es la misma clase de señal que reusar un refresh token ya rotado) | Sí       |

`UserCreated.v1` es el único de este grupo ya fijado como contrato en [03-DOMINIO.md §4](../03-DOMINIO.md); el resto se formaliza aquí por primera vez, coherente con el nivel de detalle de esta fase. `RoleDeactivated.v1` y `LoginFailed.v1` se agregaron durante la implementación de Identity & Access (Fase 0): el primero junto con el campo `RoleStatus` (ver [02-AGGREGATES.md §2](02-AGGREGATES.md)), el segundo porque `09-SEGURIDAD.md §4` exige auditar login fallido y ningún evento lo cubría. `UserMfaEnabled.v1`/`UserMfaDisabled.v1`/`MfaVerificationFailed.v1` se agregaron con MFA TOTP (docs/persistence/10-DECISIONES.md #111). `PasswordResetTokenReplayed.v1` se agregó con recuperación de contraseña (docs/persistence/10-DECISIONES.md #113).

## 4. Catálogo — Organization

| Evento                      | Payload conceptual                           | Publicado por     | Consumido por (hoy)                                                                                                                     | Cruza BC |
| --------------------------- | -------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `CompanyRegistered.v1`      | `companyId`, `legalName`, `taxId`            | `Company`         | Support (Audit)                                                                                                                         | Sí       |
| `CompanySuspended.v1`       | `companyId`, `reason`                        | `Company`         | Support (Audit, Notifications)                                                                                                          | Sí       |
| `BranchOpened.v1`           | `branchId`, `companyId`, `address`           | `Branch`          | — (interno de Organization)                                                                                                             | No       |
| `BranchClosed.v1`           | `branchId`, `companyId`                      | `Branch`          | Rental Operations (informativo — un `Vehicle` de esa `Branch` no puede recibir nuevas asignaciones, consultado vía puerto, no reactivo) | Sí       |
| `CompanySettingsUpdated.v1` | `companyId`, `policyName`, `newValueSummary` | `CompanySettings` | Support (Audit)                                                                                                                         | Sí       |

## 5. Catálogo — Scheduling

| Evento                        | Payload conceptual                                              | Publicado por      | Consumido por (hoy)                                                | Cruza BC |
| ----------------------------- | --------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------ | -------- |
| `AvailabilitySlotCreated.v1`  | `slotId`, `resourceType`, `resourceId`, `dateRange`, `slotKind` | `AvailabilitySlot` | — (consumido síncronamente vía consulta, no reactivamente en v1.0) | No       |
| `AvailabilitySlotReleased.v1` | `slotId`, `resourceType`, `resourceId`                          | `AvailabilitySlot` | —                                                                  | No       |

Nota: `Scheduling` es deliberadamente el Bounded Context con menor actividad de eventos hacia afuera — su interacción principal con `Rental Operations` es síncrona, vía `CalendarPort` (ver [01-BOUNDED_CONTEXTS.md §4.2](01-BOUNDED_CONTEXTS.md)), no reactiva. Estos dos eventos existen sobre todo para `Audit` y para una futura proyección de utilización de recursos (Reports), no como mecanismo de coordinación de negocio.

## 6. Catálogo — Rental Operations

### 6.1 Vehicle / VehicleCategory

| Evento                          | Payload conceptual                                           | Publicado por     | Consumido por (hoy)                                                                                                                  | Cruza BC |
| ------------------------------- | ------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `VehicleRegistered.v1`          | `vehicleId`, `branchId`, `licensePlate`, `vin`, `categoryId` | `Vehicle`         | —                                                                                                                                    | No       |
| `VehicleDocumentationLoaded.v1` | `vehicleId`, `documentId`, `documentType`, `validUntil`      | `Vehicle`         | Support (Audit)                                                                                                                      | Sí       |
| `VehicleEnabled.v1`             | `vehicleId`                                                  | `Vehicle`         | Scheduling (informativo, no reactivo — el vehículo se vuelve elegible para `AvailabilitySlot`)                                       | Sí       |
| `VehicleStatusChanged.v1`       | `vehicleId`, `previousStatus`, `newStatus`, `reason?`        | `Vehicle`         | Reports, Scheduling (si `newStatus` es `Maintenance`/`OutOfService`, se traduce a un `Blackout` vía la ACL de `AvailabilityService`) | Sí       |
| `MaintenanceScheduled.v1`       | `vehicleId`, `maintenanceId`, `type`, `window`               | `Vehicle`         | Scheduling (bloqueo del `AvailabilitySlot` futuro correspondiente)                                                                   | Sí       |
| `MaintenanceCompleted.v1`       | `vehicleId`, `maintenanceId`, `fitForService: boolean`       | `Vehicle`         | Reports                                                                                                                              | Sí       |
| `VehicleCategoryCreated.v1`     | `categoryId`, `companyId`, `name`                            | `VehicleCategory` | —                                                                                                                                    | No       |
| `RateChanged.v1`                | `categoryId`, `rateId`, `amount`, `validFrom`                | `VehicleCategory` | Reports (histórico de precios)                                                                                                       | Sí       |

Ya fijado en contrato previo: `VehicleStatusChanged.v1` ([03-DOMINIO.md §4](../03-DOMINIO.md)).

### 6.2 Customer

| Evento                          | Payload conceptual                         | Publicado por                                                               | Consumido por (hoy)                                                                                     | Cruza BC |
| ------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `CustomerRegistered.v1`         | `customerId`, `companyId`, `customerType`  | `Customer`                                                                  | Support (Notifications — bienvenida opcional)                                                           | Sí       |
| `CustomerDocumentValidated.v1`  | `customerId`, `documentId`, `documentType` | `Customer`                                                                  | —                                                                                                       | No       |
| `CustomerDocumentExpired.v1`    | `customerId`, `documentId`                 | `Customer` (transición automática por fecha, disparada por job de vigencia) | Support (Notifications — alerta interna, no al cliente)                                                 | Sí       |
| `AdditionalDriverRegistered.v1` | `customerId`, `driverId`                   | `Customer`                                                                  | —                                                                                                       | No       |
| `AdditionalDriverValidated.v1`  | `customerId`, `driverId`                   | `Customer` (agregado durante la implementación, no estaba en este catálogo) | —                                                                                                       | No       |
| `AdditionalDriverRevoked.v1`    | `customerId`, `driverId`                   | `Customer` (agregado durante la implementación, no estaba en este catálogo) | —                                                                                                       | No       |
| `CustomerBlocked.v1`            | `customerId`, `reason`                     | `Customer`                                                                  | Support (Audit)                                                                                         | Sí       |
| `CustomerUnblocked.v1`          | `customerId`, `unblockedBy`                | `Customer`                                                                  | Support (Audit — decisión manual auditada, [domain/07-EXCEPCIONES.md §12](../domain/07-EXCEPCIONES.md)) | Sí       |

### 6.3 Reservation

| Evento                                 | Payload conceptual                                                                       | Publicado por                                               | Consumido por (hoy)                                                                                                                        | Cruza BC |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `ReservationCreated.v1`                | `reservationId`, `customerId`, `vehicleId`, `dateRange`, `status: Draft`                 | `Reservation`                                               | —                                                                                                                                          | No       |
| `ReservationConfirmed.v1`              | `reservationId`, `customerId`, `vehicleId`, `dateRange`, `priceBreakdown`                | `Reservation`                                               | Support (Notifications, Reports)                                                                                                           | Sí       |
| `ReservationRejectedByAvailability.v1` | `reservationId`, `vehicleId`, `dateRange`                                                | `Reservation`                                               | Support (Notifications — ofrecer alternativa)                                                                                              | Sí       |
| `ReservationCancelled.v1`              | `reservationId`, `customerId`, `cancelledBy`, `penaltyApplied?: PriceAdjustment`         | `Reservation`                                               | Support (Notifications, Reports), Scheduling (liberación del slot, vía la ACL síncrona, no reactiva a este evento)                         | Sí       |
| `ReservationCheckedOut.v1`             | `reservationId`, `vehicleId`, `inspectionId`, `odometer`                                 | `Reservation`                                               | Rental Operations (`Vehicle`, vía comando síncrono — no reactivo, ver nota abajo), Support (Notifications)                                 | Sí       |
| `ReservationRescheduled.v1`            | `reservationId`, `previousRange`, `newRange`, `priceBreakdown`                           | `Reservation`                                               | Reports                                                                                                                                    | Sí       |
| `ExtensionRequested.v1`                | `reservationId`, `requestedNewEndDate`                                                   | `Reservation`                                               | —                                                                                                                                          | No       |
| `ExtensionApproved.v1`                 | `reservationId`, `newRange`, `priceBreakdown`                                            | `Reservation`                                               | Support (Notifications)                                                                                                                    | Sí       |
| `VehicleSwapped.v1`                    | `reservationId`, `previousVehicleId`, `newVehicleId`, `reason`                           | `Reservation`                                               | Rental Operations (`Vehicle` — actualización informativa de ambos vehículos)                                                               | No*      |
| `ReservationCheckedIn.v1`              | `reservationId`, `vehicleId`, `inspectionId`, `priceBreakdown` (desglose completo final) | `Reservation`                                               | Commerce (`Invoices`, dispara emisión — ACL de traducción, [01-BOUNDED_CONTEXTS.md §4.3](01-BOUNDED_CONTEXTS.md)), Support (Notifications) | Sí       |
| `NoShowRegistered.v1`                  | `reservationId`, `penaltyApplied?: PriceAdjustment`                                      | `Reservation`                                               | Support (Notifications, Reports)                                                                                                           | Sí       |
| `ReservationClosed.v1`                 | `reservationId`                                                                          | `Reservation` (reacciona internamente a `InvoiceIssued.v1`) | Reports                                                                                                                                    | No       |

`*` `VehicleSwapped.v1` no cruza Bounded Context en sentido estricto (`Vehicle` es del mismo BC que `Reservation`), pero sí cruza agregado — se mantiene como evento versionado igualmente por disciplina uniforme.

Ya fijados en contrato previo: `ReservationConfirmed.v1`, `ReservationCancelled.v1`, `ReservationCheckedOut.v1`, `ReservationCheckedIn.v1` ([03-DOMINIO.md §4](../03-DOMINIO.md)).

**Nota sobre `ReservationCheckedOut.v1` y `Vehicle`**: aunque se documenta aquí como "consumido por" `Vehicle`, la actualización de estado de `Vehicle` (RN-28: cambio de estado es responsabilidad exclusiva del propio agregado) ocurre mediante un comando explícito invocado por la capa de aplicación al manejar el evento — nunca por una escritura directa de `Reservation` sobre `Vehicle`. El evento es la señal; el comando sobre `Vehicle` es la ejecución, y sigue siendo `Vehicle` quien decide si acepta la transición.

## 7. Catálogo — Commerce

| Evento                                | Payload conceptual                                                                | Publicado por     | Consumido por (hoy)                                                                                                                         | Cruza BC |
| ------------------------------------- | --------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `SecurityDepositHeld.v1`              | `depositId`, `reservationId`, `amount`                                            | `SecurityDeposit` | Support (Notifications)                                                                                                                     | Sí       |
| `SecurityDepositReleased.v1`          | `depositId`, `reservationId`                                                      | `SecurityDeposit` | Support (Notifications)                                                                                                                     | Sí       |
| `SecurityDepositPartiallyRetained.v1` | `depositId`, `reservationId`, `retainedAmount`, `reason`                          | `SecurityDeposit` | Support (Notifications)                                                                                                                     | Sí       |
| `PaymentSucceeded.v1`                 | `paymentId`, `invoiceId?`, `depositId?`, `amount`, `method`                       | `Payment`         | Commerce (`Invoices` — concilia), Support (Notifications, Reports)                                                                          | Sí       |
| `PaymentFailed.v1`                    | `paymentId`, `invoiceId?`, `reason`                                               | `Payment`         | Support (Notifications)                                                                                                                     | Sí       |
| `PaymentRefunded.v1`                  | `paymentId`, `amount`                                                             | `Payment`         | Support (Notifications, Reports)                                                                                                            | Sí       |
| `InvoiceIssued.v1`                    | `invoiceId`, `reservationId`, `customerId`, `invoiceNumber`, `charges[]`, `total` | `Invoice`         | Support (Notifications), Commerce (`Payments` — inicia cobro si aplica), Rental Operations (`Reservation` — habilita transición a `Closed`) | Sí       |
| `InvoiceVoided.v1`                    | `invoiceId`, `reason`                                                             | `Invoice`         | Support (Audit)                                                                                                                             | Sí       |

Ya fijados en contrato previo: `PaymentSucceeded.v1`, `PaymentFailed.v1`, `InvoiceIssued.v1` ([03-DOMINIO.md §4](../03-DOMINIO.md)).

## 8. Catálogo — Support

| Evento                     | Payload conceptual                                       | Publicado por                                                                                                                                          | Consumido por (hoy)                                                                                                                                              | Cruza BC |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `FileUploaded.v1`          | `fileId`, `contentType`, `uploadedBy`                    | `File`                                                                                                                                                 | Support (Audit)                                                                                                                                                  | No       |
| `FileDeleted.v1`           | `fileId`                                                 | `File`                                                                                                                                                 | Support (Audit)                                                                                                                                                  | No       |
| `NotificationSent.v1`      | `notificationId`, `channel`, `kind`                      | `Notification`                                                                                                                                         | Support (Audit)                                                                                                                                                  | No       |
| `NotificationDelivered.v1` | `notificationId`, `deliveredAt`                          | `Notification` (traducido desde el webhook del proveedor, p. ej. `WhatsAppMessageDelivered.v1` — ver [11-INTEGRACIONES.md §3](../11-INTEGRACIONES.md)) | —                                                                                                                                                                | No       |
| `NotificationFailed.v1`    | `notificationId`, `reason`, `channelsExhausted: boolean` | `Notification`                                                                                                                                         | Rental Operations (escalamiento a Agente de Reservas si `channelsExhausted` y `kind = Confirmation`, [domain/07-EXCEPCIONES.md §4](../domain/07-EXCEPCIONES.md)) | Sí       |

`AuditLogEntry` no publica eventos — es, por diseño, un consumidor terminal (ver [02-AGGREGATES.md §17](02-AGGREGATES.md)).

## 9. Quién publica, quién consume (regla transversal)

- **Publica**: siempre la capa de aplicación del módulo dueño del agregado, al final de un Command Handler exitoso, después de persistir — nunca el propio agregado de dominio de forma directa al bus ([05-CONVENCIONES-BACKEND.md §8](../05-CONVENCIONES-BACKEND.md)). El agregado _produce_ el evento como valor/registro interno; la aplicación lo _emite_.
- **Consume**: cualquier módulo interesado, vía un `Listener` en su propia carpeta `infrastructure/events/`, sin importar código del módulo emisor más allá del _shape_ versionado del evento.
- **`Support`/`Audit` observa todo**: por regla transversal de plataforma, todo evento de dominio (sin excepción, incluidos los que no "cruzan BC" en el sentido de negocio) se registra en `AuditLogEntry`. Esta es la razón por la que no se repite como consumidor en cada fila de este catálogo — sería ruido, no información.

## 10. Garantías de entrega

- **Mecanismo actual**: bus de eventos in-process (`EventEmitter` de NestJS detrás del puerto `DomainEventPublisher`), según [ADR-0005](../ADR/0005-comunicacion-modulos.md).
- **Garantía**: entrega **at-least-once dentro del mismo proceso y la misma vida del proceso** — un evento publicado tras una transacción exitosa se entrega a todos los listeners registrados de forma síncrona dentro del ciclo de vida de esa request/job. **No sobrevive a un reinicio del proceso a mitad de una cadena de eventos** (riesgo ya aceptado explícitamente en el ADR).
- **Consistencia resultante**: eventual entre Bounded Contexts, nunca transaccional — un evento y su reacción son siempre dos transacciones separadas ([02-ARQUITECTURA.md §5.4](../02-ARQUITECTURA.md)).
- **Idempotencia de consumidores**: todo `Listener` debe ser diseñado para tolerar una entrega duplicada del mismo evento sin efecto secundario doble (p. ej. no emitir dos `Notification` idénticas) — esto es una responsabilidad del consumidor, no una garantía que el bus in-process ofrezca por sí mismo.
- **Evolución prevista**: el día que el volumen o la necesidad de garantías de entrega más fuertes lo justifique, se reemplaza el adaptador de `DomainEventPublisher` (Redis Streams/Kafka) sin cambiar ningún productor ni consumidor — ya fijado en [ADR-0005](../ADR/0005-comunicacion-modulos.md) y en [02-ARQUITECTURA.md §10](../02-ARQUITECTURA.md).

## 11. Compatibilidad futura y versionado

Reglas heredadas de [08-API-CONTRACTS.md §10](../08-API-CONTRACTS.md) aplicadas a eventos (el mismo estándar de compatibilidad que ya rige la API pública, para que un desarrollador no tenga que aprender dos disciplinas de versionado distintas):

1. **Agregar un campo opcional al payload no es un cambio incompatible** — un consumidor existente que ignora el campo nuevo sigue funcionando.
2. **Eliminar, renombrar, o cambiar el tipo/semántica de un campo existente sí lo es** — exige publicar un `eventType` nuevo (`.v2`) mientras el productor mantenga, si es necesario durante la transición, ambas versiones publicadas simultáneamente hasta que todos los consumidores migren.
3. **Un consumidor nuevo que necesita un campo que el evento actual no tiene** no debe forzar una v2 inmediatamente si el dato puede obtenerse por un puerto síncrono adicional — la primera pregunta ante esa necesidad es "¿realmente es un cambio de contrato, o el consumidor debería consultar el dato en el momento en vez de recibirlo por evento?" (mismo espíritu que el principio rector #5 de [00-VISION.md §5](../00-VISION.md)).
4. **Ningún evento de este catálogo se elimina silenciosamente** — un evento que deja de tener consumidores se marca como deprecado en este documento (con la razón) antes de eliminar su publicación, para que la historia de por qué existió no se pierda.
5. **`companyId` es obligatorio en todo evento cuyo sujeto no sea la propia `Company`** — es lo que permite, a futuro, filtrar/particionar el bus de eventos por tenant si el volumen lo exige, sin rediseñar el payload.
