# 02 — Aggregates

Este documento define los agregados definitivos de la Plataforma: la unidad de consistencia transaccional de cada Bounded Context (ver [01-BOUNDED_CONTEXTS.md](01-BOUNDED_CONTEXTS.md)). Un agregado se carga, se modifica y se persiste como una unidad; ninguna transacción cruza dos agregados (ver [09-DEPENDENCIES.md](09-DEPENDENCIES.md) sobre cómo colaboran sin transacción compartida).

**Convención de esta tabla por agregado**: Objetivo → Responsabilidad → Root → Entidades internas → Value Objects → Eventos → Invariantes → Transacciones → Lifecycle → Límites → Reglas de modificación → Reglas de consistencia → Justificación de diseño (alternativas descartadas cuando existieron).

## Índice de agregados por Bounded Context

| Bounded Context   | Agregados                                               |
| ----------------- | ------------------------------------------------------- |
| Identity & Access | `User`, `Role`, `Session`                               |
| Organization      | `Company`, `Branch`, `CompanySettings`                  |
| Scheduling        | `AvailabilitySlot`                                      |
| Rental Operations | `VehicleCategory`, `Vehicle`, `Customer`, `Reservation` |
| Commerce          | `SecurityDeposit`, `Payment`, `Invoice`                 |
| Support           | `File`, `Notification`, `AuditLogEntry`                 |

`Reports` no tiene agregados — ver [01-BOUNDED_CONTEXTS.md §3.6](01-BOUNDED_CONTEXTS.md).

---

## 1. `User` (Identity & Access)

**Objetivo**: representar a un actor humano con credenciales de acceso a la Plataforma.

**Responsabilidad**: proteger la integridad de las credenciales y del estado habilitado/deshabilitado de un usuario. No decide autorización fina (eso es `Role`) ni mantiene el estado de sesión activa (eso es `Session`).

**Root**: `User` (`UserId`).

**Entidades internas**: ninguna. Un `User` no necesita entidades hijas propias — sus credenciales son un VO reemplazable, no un histórico que requiera identidad propia dentro del agregado.

**Value Objects**: `Email`, `PasswordHash` (nunca la contraseña en claro, ni siquiera transitoriamente dentro del agregado), `PersonName`, `UserStatus` (`Active`, `Disabled`).

**Eventos**: `UserCreated.v1` (contrato ya fijado en [03-DOMINIO.md §4](../03-DOMINIO.md)), `UserDisabled.v1`, `UserPasswordChanged.v1`.

**Invariantes**:

- Un `Email` es único dentro de su `companyId` (dos companies distintas pueden tener usuarios con el mismo email; ver [ADR-0004](../ADR/0004-multitenancy.md) sobre por qué la unicidad se ancla al tenant).
- Un `User` en estado `Disabled` no puede autenticar una nueva `Session` (invariante que protege este agregado; la consecuencia sobre sesiones ya emitidas se resuelve por `Session`, ver §3).
- `roles: RoleId[]` es una lista de referencias, nunca una copia del contenido del `Role` — evita que `User` deba conocer el catálogo de `Permission`.

**Transacciones**: creación, cambio de contraseña, asignación/revocación de rol, deshabilitación — todas dentro de una única transacción ACID sobre la fila de `User`.

**Lifecycle**: `Invited`/`Active` → `Disabled` (reversible por un Administrador) → eliminación física solo por proceso administrativo separado (no expuesto como caso de uso de negocio ordinario, coherente con la retención exigida por auditoría).

**Límites**: no contiene el historial de sesiones (vive en `Session`), no contiene el detalle de `Permission` (vive en `Role`), no contiene ninguna referencia a `Branch` más allá de un `branchId` opcional (scoping operativo, no una relación rica).

**Reglas de modificación**: solo el propio `User` (autogestión de contraseña) o un Administrador de Empresa con permiso `users:manage` pueden mutar el agregado — verificado en la capa de aplicación, no en el dominio (el dominio no conoce RBAC, ver [01-BOUNDED_CONTEXTS.md §3.1](01-BOUNDED_CONTEXTS.md)).

**Reglas de consistencia**: fuertemente consistente consigo mismo; eventualmente consistente hacia `Audit` (vía evento) y hacia `Session` (una `Session` existente no se invalida instantáneamente al deshabilitar un `User` salvo revocación explícita — ver [ADR-0008](../ADR/0008-autenticacion-jwt-refresh.md) sobre el trade-off ya aceptado de hasta 15 minutos de propagación).

**Justificación de diseño**: se descartó modelar `User` con las `Permission` embebidas directamente (denormalizado) porque un cambio de `Role` afectaría a todos los `User` que lo usan simultáneamente sin mecanismo de agregado claro — la indirección por `RoleId` es la única forma de que "cambiar un rol" sea una operación de un agregado (`Role`), no una operación masiva sobre `User`.

---

## 2. `Role` (Identity & Access)

**Objetivo**: agrupar `Permission` en un conjunto con nombre, asignable a `User`.

**Responsabilidad**: proteger que un rol tenga un conjunto de permisos válido y consistente (p. ej., no duplicados, todos pertenecientes al catálogo vigente de la Plataforma).

**Root**: `Role` (`RoleId`).

**Entidades internas**: ninguna.

**Value Objects**: `Permission` (VO inmutable, ver [04-VALUE_OBJECTS.md §2](04-VALUE_OBJECTS.md) sobre por qué `Permission` nunca es una entidad), `RoleName`, `RoleScope` (`System` | `Custom`), `RoleStatus` (`Active` | `Inactive`).

**Eventos**: `RoleCreated.v1`, `RolePermissionsChanged.v1`, `RoleDeactivated.v1`.

**Invariantes**:

- Un `Role` de `RoleScope = System` (roles base de Plataforma: Administrador de Empresa, Operador de Sucursal, etc. — ver [domain/01-ACTORES.md](../domain/01-ACTORES.md)) no puede eliminarse ni editar su conjunto base de `Permission`, solo puede clonarse como `Custom` y modificarse.
- El conjunto de `Permission` de un `Role` no puede quedar vacío tras una edición (un rol sin permisos no es un error de datos, es un estado sin sentido de negocio).
- `deactivate()` solo es válido sobre `RoleScope = Custom`; un `Role` `System` nunca transiciona a `Inactive` (mismo invariante que ya prohíbe editarlo/eliminarlo, INV-026).

**Transacciones**: creación y edición del conjunto de permisos, dentro de una única transacción.

**Lifecycle**: `Active` → `Inactive` (campo `status: RoleStatus`, agregado durante la implementación de Identity & Access — Fase 0; ver [08-STATE_MACHINES.md](08-STATE_MACHINES.md) y [persistence/10-DECISIONES.md](../persistence/10-DECISIONES.md)). Los roles `Custom` pueden desactivarse; los `System` no — `Inactive` es terminal, no hay reactivación modelada en esta fase.

**Límites**: no conoce qué `User` lo tienen asignado (la relación se resuelve desde `User`, evitando que asignar un rol a un empleado más sea una escritura sobre `Role`).

**Reglas de modificación**: solo un Administrador de Empresa con permiso `roles:manage`, y únicamente sobre roles `Custom` de su propia `Company` (los roles `System` son globales de Plataforma, de solo lectura para toda `Company`).

**Reglas de consistencia**: fuertemente consistente consigo mismo; el efecto de un cambio de `Role` sobre los `access_token` ya emitidos de sus usuarios es eventual, acotado por la vida corta del JWT (ver [ADR-0008](../ADR/0008-autenticacion-jwt-refresh.md)).

**Justificación de diseño**: se evaluó modelar `Permission` como agregado propio (con su propio ciclo de vida de alta/baja) y se descartó — el catálogo de permisos es un catálogo de sistema versionado junto al código (cada capacidad nueva declara sus permisos), no un dato de negocio mutable en runtime; convertirlo en agregado añadiría una capa de indirección sin invariante real que proteger.

---

## 3. `Session` (Identity & Access)

**Objetivo**: representar el ciclo de vida de una sesión autenticada (par access/refresh token).

**Responsabilidad**: proteger la regla de rotación de un solo uso del refresh token y permitir revocación explícita.

**Root**: `Session` (`SessionId`).

**Entidades internas**: ninguna.

**Value Objects**: `RefreshTokenHash` (nunca el token en claro), `SessionStatus` (`Active`, `Rotated`, `Revoked`), `DeviceContext` (metadata no sensible: user-agent, IP aproximada — con fines de auditoría, no de negocio).

**Eventos**: `SessionCreated.v1`, `SessionRevoked.v1`, `SessionTheftDetected.v1` (cuando se reutiliza un refresh token ya rotado — ver [09-SEGURIDAD.md §1](../09-SEGURIDAD.md)).

**Invariantes**:

- Un `RefreshTokenHash` usado para rotar solo puede usarse una vez; su reutilización marca automáticamente `SessionTheftDetected.v1` y fuerza `Revoked` en **todas** las `Session` activas de ese `User` (no solo la afectada) — este es el invariante de seguridad más crítico del agregado.
- Una `Session` en `Revoked` no puede volver a `Active` bajo ninguna operación.

**Transacciones**: creación (login), rotación (refresh), revocación — cada una una transacción atómica sobre la fila de `Session` afectada; la revocación masiva ante robo de token es una transacción que abarca todas las `Session` del mismo `UserId` (dentro del mismo agregado técnico de almacenamiento, aceptable porque todas pertenecen conceptualmente al mismo `User` y es una operación de seguridad, no de negocio ordinario).

**Lifecycle**: `Active` → `Rotated` (al emitir un refresh) o `Revoked` (logout, cambio de contraseña, detección de robo).

**Límites**: no contiene el `access_token` (este nunca se persiste — es autocontenible y stateless por diseño, ver [ADR-0008](../ADR/0008-autenticacion-jwt-refresh.md)); solo el `RefreshTokenHash`.

**Reglas de modificación**: solo el propio flujo de autenticación (`application/` de Identity) muta este agregado; ningún otro módulo lo referencia directamente.

**Reglas de consistencia**: fuertemente consistente consigo mismo; publica evento hacia `Audit` de forma eventual.

**Justificación de diseño**: separar `Session` de `User` (en vez de anidarlo como entidad interna) es deliberado — la tasa de escritura de `Session` (cada login, cada refresh, potencialmente cada pocos minutos por usuario activo) es órdenes de magnitud mayor que la de `User` (cambia raramente). Anidarlos forzaría a cargar y bloquear el agregado `User` completo en cada refresh, un costo de contención sin beneficio de consistencia real — ningún invariante de negocio exige que `User` y `Session` cambien en la misma transacción.

---

## 4. `Company` (Organization)

**Objetivo**: representar a la empresa cliente de la Plataforma (el tenant).

**Responsabilidad**: proteger los datos fundacionales e identitarios de la empresa (razón social, datos fiscales, estado de la cuenta comercial con la Plataforma).

**Root**: `Company` (`CompanyId`).

**Entidades internas**: ninguna.

**Value Objects**: `LegalName`, `TaxId` (a nivel de la propia empresa, distinto del `TaxId` de un `Customer`), `BillingContact`, `CompanyStatus` (`Active`, `Suspended` — p. ej. por impago de la suscripción a la Plataforma, un concepto distinto y superior a la morosidad de un `Customer` dentro del negocio de esa `Company`).

**Eventos**: `CompanyRegistered.v1`, `CompanySuspended.v1`.

**Invariantes**:

- `TaxId` único a nivel de Plataforma (dos `Company` no pueden compartir identidad fiscal — esta es una de las pocas unicidades verdaderamente globales, no por tenant).
- Una `Company` en `Suspended` no habilita ninguna operación de negocio para sus `Branch`/`User` (regla de plataforma, no de ningún producto).

**Transacciones**: alta y cambios de estado de cuenta, dentro de una única transacción.

**Lifecycle**: `Active` ↔ `Suspended` → (baja, proceso administrativo fuera de alcance de este documento).

**Límites**: no contiene la lista de `Branch` (agregado propio, ver §5), no contiene `CompanySettings` (agregado propio, ver §6), no contiene `User` (pertenecen a Identity & Access, referenciados por `companyId`).

**Reglas de modificación**: solo un Administrador de Empresa (datos propios) o un rol de super-administración de Plataforma (suspensión por impago de la suscripción SaaS — un caso cross-tenant explícitamente documentado, ver [08-API-CONTRACTS.md §2](../08-API-CONTRACTS.md)).

**Reglas de consistencia**: raíz de todo el modelo multi-tenant; toda entidad de negocio de cualquier BC referencia `companyId` sin FK física entre schemas ([04-MODELO-DATOS.md §3](../04-MODELO-DATOS.md)).

**Justificación de diseño**: no se fusiona con `Branch` en el mismo agregado (alternativa considerada) porque `Branch` cambia con más frecuencia (altas, horarios, dirección) y no comparte invariantes transaccionales con los datos fundacionales de `Company` — exactamente el mismo criterio que separa `CompanySettings`.

---

## 5. `Branch` (Organization)

**Objetivo**: representar una sucursal operativa de una `Company`.

**Responsabilidad**: proteger los datos propios de la sucursal (dirección, horario) y servir como ancla de scoping físico para `Vehicle` y, operativamente, para `User`.

**Root**: `Branch` (`BranchId`).

**Entidades internas**: ninguna.

**Value Objects**: `Address`, `OperatingHours`, `BranchStatus` (`Active`, `Closed`), `BranchName` (agregado durante la implementación de Organization — no estaba en el catálogo original, ver [04-VALUE_OBJECTS.md §3](04-VALUE_OBJECTS.md); una sucursal sin nombre no es usable en ningún flujo real, mismo hueco que `PersonName` tuvo para `User` en Identity & Access).

**Eventos**: `BranchOpened.v1`, `BranchClosed.v1`.

**Invariantes**:

- Un `Branch` referencia exactamente un `CompanyId`, inmutable tras la creación (una sucursal no cambia de empresa dueña).
- Un `Branch` en `Closed` no puede recibir nuevas asignaciones de `Vehicle` ni nuevos `Check-out` (la validación de este segundo efecto vive en `Reservation`, que consulta el estado de la `Branch` vía puerto — es una regla que involucra dos agregados y por tanto no puede ser un invariante interno de `Branch`, ver [07-INVARIANTS.md §2](07-INVARIANTS.md) sobre invariantes cross-aggregate).

**Transacciones**: alta, edición de datos propios, apertura/cierre — una transacción por operación.

**Lifecycle**: `Active` ↔ `Closed`.

**Límites**: no contiene la lista de `Vehicle` que aloja (relación inversa, resuelta por `branchId` desde `Vehicle`), no contiene `User` asignados.

**Reglas de modificación**: Administrador de Empresa únicamente.

**Reglas de consistencia**: referenciado por ID (`branchId`) desde `Vehicle` (Rental Operations) sin FK física cross-schema.

**Justificación de diseño**: se consideró y descartó modelar `Branch` como entidad interna de `Company` (alternativa más simple a primera vista) — se descartó porque `Vehicle`, `Reservation` y potencialmente `User` necesitan referenciar una `Branch` específica por ID de forma estable y consultarla de forma independiente (p. ej. "¿esta sucursal está abierta?") sin cargar la `Company` completa; DDD desaconseja anidar como entidad algo referenciado externamente con esa frecuencia.

---

## 6. `CompanySettings` (Organization)

**Objetivo**: centralizar toda la política de negocio configurable por `Company` (ver [domain/05-REGLAS-NEGOCIO.md](../domain/05-REGLAS-NEGOCIO.md) para el catálogo completo de reglas configurables).

**Responsabilidad**: ser la única fuente de verdad de: política de cancelación (RN-26), política de garantía (RN-21), tabla de penalización por tardanza y tolerancia de gracia (RN-15, RN-16), umbrales de mantenimiento preventivo (RN-29), métodos de pago habilitados (RN-24), tiempo de expiración de `Draft` (RN-05), antelación mínima de reserva (RN-06), canal de notificación preferido por defecto (RN-33), y el **registro de módulos/producto activos** de la company ([02-ARQUITECTURA.md §4.2](../02-ARQUITECTURA.md)).

**Root**: `CompanySettings` (identidad = `CompanyId`, relación 1:1 con `Company` pero agregado separado).

**Entidades internas**: ninguna — cada política es un Value Object propio, reemplazado como unidad, nunca mutado campo a campo desde fuera.

**Value Objects**: `CancellationPolicy` (ventanas de anticipación + porcentaje de penalidad por tramo), `DepositPolicy` (si aplica, monto/mecanismo), `LateReturnPolicy` (tolerancia de gracia + tabla de tarifa por exceso), `MaintenanceThresholdPolicy` (km y/o tiempo), `PaymentMethodsEnabled` (conjunto), `DraftExpirationPolicy` (duración), `MinimumBookingLeadTime`, `NotificationChannelPreference`, `EnabledProductModules` (conjunto de productos activos: hoy solo `Rental`, extensible a `Workshop`, etc.).

**Eventos**: `CompanySettingsUpdated.v1` (evento único y genérico con el nombre de la política cambiada en el payload, no un evento por cada política — ver justificación abajo).

**Invariantes**:

- Ninguna política aquí puede relajar una regla 🔴 Crítica del catálogo de negocio — este es el invariante rector de todo el agregado, heredado literalmente de [domain/05-REGLAS-NEGOCIO.md §7](../domain/05-REGLAS-NEGOCIO.md): "ninguna configuración a nivel de Company puede relajar una regla crítica". En términos de modelado, esto significa que `CompanySettings` **no tiene** ningún campo para desactivar RN-01, RN-02, RN-04, RN-08, RN-13, RN-14, RN-22, RN-25, RN-28, RN-31 — no existen como opción configurable en el Value Object correspondiente, no se valida en runtime como un "if": es una ausencia deliberada de superficie.
- `EnabledProductModules` no puede quedar vacío (una `Company` sin ningún producto activo no tiene sentido de negocio).

**Transacciones**: cada actualización de una política individual es una transacción sobre el agregado completo de `CompanySettings` (el agregado es pequeño y de bajo volumen de escritura relativo, así que no se justifica partirlo más).

**Lifecycle**: creado junto con `Company` (con valores por defecto de Plataforma), editado indefinidamente durante la vida de la `Company`. No se elimina mientras la `Company` exista.

**Límites**: no contiene ninguna regla 🔴 Crítica ni ninguna definición de `Vehicle Category`/`Rate` (eso vive en `VehicleCategory`, un agregado de Rental Operations con su propio ciclo de vida y volumen, ver §9) — `CompanySettings` es política operativa transversal, no catálogo comercial.

**Reglas de modificación**: exclusivamente el Administrador de Empresa.

**Reglas de consistencia**: leído (no bloqueante) por `Reservation`, `Vehicle` y `Invoice` en el momento de aplicar la regla correspondiente, vía puerto síncrono publicado por `Organization` — nunca copiado ni cacheado dentro de otro agregado (evita que una `Reservation` ya creada quede con una política obsoleta si no la consulta en el momento del cálculo).

**Justificación de diseño**: se evaluó modelar cada política como su propio agregado pequeño (p. ej. `CancellationPolicy` como agregado independiente) y se descartó — ninguna política tiene invariante propio que proteger más allá de su propia validez interna (p. ej. "el porcentaje de penalidad está entre 0 y 100"), y todas cambian por el mismo actor (Administrador de Empresa) con la misma cardinalidad (una por `Company`); partirlas en agregados separados multiplicaría la complejidad de composición sin beneficio de consistencia. Se prefirió un único evento genérico (`CompanySettingsUpdated.v1`) en vez de un evento por política porque los consumidores (`Reservations`, `Vehicles`) leen la política vigente en el momento que la necesitan vía puerto síncrono, no reaccionan a su cambio de forma asíncrona — el evento existe principalmente para `Audit`.

---

## 7. `AvailabilitySlot` (Scheduling)

**Objetivo**: representar un bloque de tiempo en que un recurso genérico está ocupado o bloqueado.

**Responsabilidad**: ser la única fuente de verdad de "¿está libre este recurso en este rango?", con total desconocimiento de qué es el recurso.

**Root**: `AvailabilitySlot` (`AvailabilitySlotId`).

**Entidades internas**: ninguna.

**Value Objects**: `ResourceRef` (`resourceType: string`, `resourceId: string` — deliberadamente genéricos, nunca `VehicleId`), `DateRange`, `SlotKind` (`Booking` con `referenceId` opaco | `Blackout` con motivo libre de texto).

**Eventos**: `AvailabilitySlotCreated.v1`, `AvailabilitySlotReleased.v1`.

**Invariantes**:

- Dos `AvailabilitySlot` activos para el mismo `ResourceRef` no pueden solaparse en su `DateRange` — este es el invariante técnico que sostiene RN-02, expresado en el lenguaje genérico de Scheduling (no como "reserva", sino como "slot"). Se garantiza además a nivel de base de datos con `exclusion constraint` GiST ([04-MODELO-DATOS.md §8](../04-MODELO-DATOS.md)) como segunda capa de defensa, igual que RLS lo es para multi-tenancy.
- Un `Blackout` no requiere `referenceId` (no proviene de una reserva); un `Booking` sí lo requiere y es responsabilidad del consumidor (`Rental Operations`) garantizar que apunta a algo real — `Scheduling` no lo valida porque no conoce el tipo referenciado.

**Transacciones**: creación (ocupar), liberación — cada una atómica sobre el `AvailabilitySlot` afectado, protegida por el exclusion constraint para el caso de condición de carrera entre dos solicitudes concurrentes.

**Lifecycle**: `Active` → `Released` (liberación explícita, nunca "editado" en el rango — un cambio de fechas es liberar el slot viejo y crear uno nuevo, atómicamente, nunca un estado intermedio con ambos activos o ambos liberados, ver la misma regla de negocio en [domain/07-EXCEPCIONES.md §7](../domain/07-EXCEPCIONES.md) sobre Vehicle Swap).

**Límites**: no contiene ningún dato de negocio de quien ocupa el recurso — ni `CustomerId`, ni `VehicleCategory`, ni monto. Solo el hecho puro de ocupación temporal.

**Reglas de modificación**: solo a través del puerto `CalendarPort` publicado por Scheduling, consumido por la ACL de `Rental Operations` (ver [01-BOUNDED_CONTEXTS.md §4.2](01-BOUNDED_CONTEXTS.md)).

**Reglas de consistencia**: fuertemente consistente consigo mismo (garantía de no-solapamiento a nivel de motor de base de datos); la relación con la `Reservation` que lo originó es eventual y por referencia opaca, nunca por FK.

**Justificación de diseño**: alternativa descartada — modelar la disponibilidad directamente como un campo calculado dentro de `Vehicle` (p. ej. una lista de fechas ocupadas embebida). Se descartó explícitamente porque acoplaría el motor de disponibilidad al concepto "vehículo", exactamente lo que impide la reutilización para Taller/Hotel/Clínica — decisión ya tomada en [03-DOMINIO.md §5](../03-DOMINIO.md) y reafirmada aquí a nivel de agregado.

---

## 8. `Vehicle` (Rental Operations)

**Objetivo**: representar una unidad de flota disponible para alquiler.

**Responsabilidad**: proteger su propio ciclo de vida operativo (disponible / en mantenimiento / fuera de servicio) y su documentación legal vigente. Es, por diseño de negocio ([domain/05-REGLAS-NEGOCIO.md](../domain/05-REGLAS-NEGOCIO.md), RN-28), el único agregado autorizado a decidir su disponibilidad estructural.

**Root**: `Vehicle` (`VehicleId`).

**Entidades internas**:

- `VehicleDocument` (identidad propia: `documentId`; tipo — tarjeta de propiedad, seguro, permiso de circulación —, referencia a `File`, fecha de vigencia, estado `Valid`/`Expired`). Es entidad y no Value Object porque tiene ciclo de vida propio (se carga, se reemplaza al renovarse, puede vencer de forma asíncrona sin que nadie "edite" el vehículo ese día) — ver justificación de VO vs. entidad en [03-ENTITIES.md §2](03-ENTITIES.md).
- `MaintenanceRecord` (identidad propia: `maintenanceId`; tipo `Preventive`/`Corrective`, ventana programada, proveedor externo si aplica, resultado de verificación de aptitud).

**Value Objects**: `LicensePlate`, `VIN`, `Odometer`, `VehicleStatus` (`Available`, `Reserved`, `CheckedOut`, `Maintenance`, `OutOfService` — nota: `Reserved`/`CheckedOut` son un reflejo informativo del compromiso vigente, la fuente de verdad transaccional de la ocupación temporal sigue siendo `AvailabilitySlot` vía Scheduling, ver §14 sobre `Reservation`).

**Eventos**: `VehicleRegistered.v1`, `VehicleDocumentationLoaded.v1`, `VehicleEnabled.v1`, `VehicleStatusChanged.v1` (contrato v1 ya fijado en [03-DOMINIO.md §4](../03-DOMINIO.md)), `MaintenanceScheduled.v1`, `MaintenanceCompleted.v1`.

**Invariantes**:

- Un `Vehicle` no puede pasar a `Available` sin al menos un `VehicleDocument` vigente por cada tipo legalmente obligatorio (RN-27) — el conjunto de tipos obligatorios es dato de configuración dependiente de país, pero la regla ("no habilitar sin documentación completa") es universal y vive aquí, no en `CompanySettings`.
- Un `Vehicle` en `Maintenance` u `OutOfService` no puede exponerse como disponible ni completar un Check-out (RN-04) — este agregado es quien produce el hecho (`VehicleStatusChanged.v1`); la consecuencia sobre `AvailabilitySlot` la aplica `Rental Operations` reaccionando al evento, no `Vehicle` directamente (`Vehicle` no conoce `Scheduling`).
- El cambio de `VehicleStatus` es responsabilidad exclusiva de este agregado (RN-28): ningún caso de uso de `Reservation` escribe directamente el estado de un `Vehicle`; a lo sumo, dispara un comando sobre `Vehicle` (p. ej., tras un `CheckOut`, el caso de uso de aplicación invoca `vehicle.markAsCheckedOut()`, pero la decisión y la validación del invariante ocurre dentro del propio agregado `Vehicle`).
- Un `Vehicle` pertenece exactamente a un `BranchId`, inmutable salvo un movimiento explícito de sucursal (caso de devolución en sucursal distinta, [domain/07-EXCEPCIONES.md §11](../domain/07-EXCEPCIONES.md)), nunca a más de una simultáneamente (RN-31).
- Un `MaintenanceRecord` programado bloquea la disponibilidad futura del `Vehicle` desde el momento en que se programa, no solo durante la intervención física (regla de negocio explícita en [domain/03-PROCESOS.md §10](../domain/03-PROCESOS.md)).

**Transacciones**: alta, carga de documentación, habilitación, cambio de estado, programación/cierre de mantenimiento — cada una una transacción atómica sobre el agregado `Vehicle` completo (incluye sus `VehicleDocument`/`MaintenanceRecord` internos).

**Lifecycle**: ver máquina de estados completa en [08-STATE_MACHINES.md §2](08-STATE_MACHINES.md). Resumen: `Registered` (sin habilitar) → `Available` ↔ `Maintenance`/`OutOfService` (vía Responsable de Mantenimiento) ↔ reflejo informativo de `Reserved`/`CheckedOut` (vía eventos de `Reservation`) → baja (fuera de alcance operativo de v1.0, tratada como proceso administrativo).

**Límites**: no contiene el historial de `Reservation` (relación inversa, vive en `Reservation` por `vehicleId`), no contiene `AvailabilitySlot` (vive en Scheduling), no contiene `DamageReport` de un alquiler específico (vive en `Reservation`, ver §14 — un `Vehicle` solo conoce que tuvo un `MaintenanceRecord` correctivo derivado de un daño, no el detalle del alquiler que lo originó).

**Reglas de modificación**: alta/documentación/habilitación por Administrador de Empresa u operativo delegado; cambio de estado operativo y mantenimiento exclusivamente por Responsable de Mantenimiento (con la excepción de que un `CheckOut`/`CheckIn` exitoso de `Reservation` también dispara transiciones informativas vía comando, no vía edición directa).

**Reglas de consistencia**: fuertemente consistente consigo mismo; su relación con `AvailabilitySlot` es eventual (el `Vehicle` pasa a `Maintenance`, y la reacción que bloquea el `AvailabilitySlot` correspondiente ocurre en una transacción separada, coordinada por `VehicleStatusChanged.v1`).

**Justificación de diseño**: se evaluó incluir `Rate`/tarifa dentro de `Vehicle` (alternativa simple) y se descartó — el precio depende de la `VehicleCategory`, no del vehículo físico individual, y dos vehículos de la misma categoría no deben poder tener tarifas divergentes por error de captura; separar `VehicleCategory` como agregado propio (§9) hace ese invariante expresable.

---

## 9. `VehicleCategory` (Rental Operations)

**Objetivo**: representar la clasificación comercial de vehículos (económico, SUV, premium) y su tarifa vigente.

**Responsabilidad**: proteger que las tarifas (`Rate`) de una categoría no se solapen en el tiempo — la misma clase de invariante temporal que `Reservation` protege para vehículos, aplicada aquí a precios.

**Root**: `VehicleCategory` (`VehicleCategoryId`).

**Entidades internas**: `Rate` (identidad propia: `rateId`; `amount: Money`, `unit` — día/semana —, `validFrom`, `validTo` opcional). Es entidad porque cada `Rate` histórico debe conservar su propia identidad y vigencia para poder recalcular el precio de una reserva pasada con la tarifa que estaba vigente en ese momento (RN-20: "la Rate vigente al momento de la confirmación, no de la consulta inicial").

**Value Objects**: `CategoryName`, `CategoryDescription`.

**Eventos**: `VehicleCategoryCreated.v1`, `RateChanged.v1`.

**Invariantes**:

- Dos `Rate` de la misma `VehicleCategory` no pueden tener `DateRange` de vigencia solapados (no puede haber ambigüedad sobre qué tarifa aplica en una fecha dada).
- Una `VehicleCategory` no puede quedar sin ninguna `Rate` vigente si tiene `Vehicle` activos asociados (no se puede cotizar ni confirmar una reserva sin precio) — invariante que se valida en el momento de cotizar, no bloquea la edición retroactiva de tarifas históricas.

**Transacciones**: alta de categoría, alta/edición de `Rate` — una transacción por operación sobre el agregado completo.

**Lifecycle**: `Active` (una categoría no se "cierra": se deja de usar dejando de asociarle vehículos nuevos).

**Límites**: no contiene la lista de `Vehicle` de esa categoría (relación inversa por `vehicleCategoryId`).

**Reglas de modificación**: Administrador de Empresa (política comercial, [domain/06-CASOS-USO.md §1](../domain/06-CASOS-USO.md)).

**Reglas de consistencia**: leído síncronamente por `PricingService` (ver [05-DOMAIN_SERVICES.md](05-DOMAIN_SERVICES.md)) al cotizar/confirmar una `Reservation`.

**Justificación de diseño**: alternativa descartada — modelar `Rate` como Value Object simple (un único precio "actual" reemplazado en cada cambio). Se descartó porque pierde la capacidad de auditar/recalcular con qué tarifa se cobró una reserva pasada, un requisito de negocio explícito (RN-20) que exige historial, no solo el valor vigente.

---

## 10. `Customer` (Rental Operations)

**Objetivo**: representar a la persona natural o jurídica que alquila vehículos.

**Responsabilidad**: proteger la vigencia documental que habilita a un cliente (y a sus conductores autorizados) a completar una reserva.

**Root**: `Customer` (`CustomerId`).

**Entidades internas**:

- `IdentityDocument` (identidad propia: `documentId`; tipo — identidad, licencia de conducir —, referencia a `File`, fecha de vigencia, estado `Pending`/`Verified`/`Expired`, y si proviene de OCR, un flag `extractedByOcr` hasta su confirmación humana explícita — RN-12). Entidad, no VO, por la misma razón que `VehicleDocument`: tiene ciclo de vida propio de reemplazo/vencimiento asíncrono.
- `AdditionalDriver` (identidad propia: `driverId`; nombre, licencia de conducir propia como `IdentityDocument` anidado, estado `Registered`/`Validated`/`Revoked`). Es entidad interna de `Customer` — y no de `Reservation` — porque un cliente corporativo registra su roster de conductores autorizados una vez y lo reutiliza across múltiples reservas (ver [domain/01-ACTORES.md §3.2](../domain/01-ACTORES.md)); `Reservation` solo referencia por `driverId` cuáles de ellos están autorizados para ese alquiler puntual (ver §14).

**Value Objects**: `TaxId`/`DocumentId` (identificador fiscal/personal), `ContactInfo` (email, teléfono), `CustomerType` (`Individual` | `Corporate`), `CustomerBlockStatus` (`None`, `Blocked` con motivo — RN de [domain/07-EXCEPCIONES.md §12](../domain/07-EXCEPCIONES.md)).

**Eventos**: `CustomerRegistered.v1`, `CustomerDocumentValidated.v1`, `CustomerDocumentExpired.v1`, `AdditionalDriverRegistered.v1`, `CustomerBlocked.v1`, `CustomerUnblocked.v1`.

**Invariantes**:

- Un `Customer` con `IdentityDocument` principal vencido no puede habilitarse para una `Reservation` en estado `Confirmed` (RN-08) — el invariante vive aquí como un predicado que expone (`isEligibleForConfirmation(): boolean`); la decisión de bloquear la confirmación misma ocurre en `Reservation`, que lo consulta vía puerto síncrono (invariante cross-aggregate, ver [07-INVARIANTS.md §2](07-INVARIANTS.md)).
- Un `AdditionalDriver` no puede quedar `Validated` sin una licencia de conducir vigente propia (RN-09).
- Un `Customer` en `CustomerBlockStatus = Blocked` no habilita nuevas confirmaciones — salvo desbloqueo manual explícito y auditado por un Administrador de Empresa (regla de negocio explícita: el sistema nunca impide absolutamente que un humano con autoridad decida, [domain/07-EXCEPCIONES.md §12](../domain/07-EXCEPCIONES.md)).
- Los datos de un `IdentityDocument` con `extractedByOcr = true` no se consideran verdad de negocio (no habilitan nada) hasta que un actor humano los confirma explícitamente (RN-12) — invariante universal, no configurable.

**Transacciones**: alta, carga/validación de documentos, alta de conductor adicional, bloqueo/desbloqueo — cada una atómica sobre el agregado `Customer` completo.

**Lifecycle**: `Registered` → `Active` (documentación validada) ↔ `Blocked`; documentos internos con su propio sub-lifecycle `Pending`/`Verified`/`Expired`.

**Límites**: no contiene el historial de `Reservation` del cliente (relación inversa por `customerId`), no contiene información de pago/facturación (vive en Commerce, referenciado por `customerId`).

**Reglas de modificación**: el propio `Customer` (autogestión) o Agente de Reservas en su nombre; la validación documental y el bloqueo/desbloqueo requieren un actor interno con permiso específico.

**Reglas de consistencia**: consultado síncronamente por `Reservation` en el momento de confirmar (nunca copiado/cacheado dentro de `Reservation` — evita datos de elegibilidad obsoletos).

**Justificación de diseño**: se evaluó modelar `AdditionalDriver` como parte de `Reservation` en lugar de `Customer` (alternativa más simple para el caso de cliente individual) y se descartó como regla general porque el caso de cliente corporativo (RN-11, múltiples conductores reutilizados entre reservas) es explícito en el descubrimiento de negocio ([domain/01-ACTORES.md §3.2](../domain/01-ACTORES.md)) — modelarlo solo dentro de `Reservation` obligaría a re-registrar cada conductor en cada alquiler, perdiendo el historial de validación ya realizado.

---

## 11. `Reservation` (Rental Operations)

**Objetivo**: representar el compromiso transaccional de un `Customer` sobre un `Vehicle` en un rango de fechas. Es el corazón transaccional del producto ([03-DOMINIO.md §3.1](../03-DOMINIO.md)).

**Responsabilidad**: proteger el invariante de no-solapamiento, la máquina de estados del ciclo de alquiler, y la trazabilidad de inspección física que sostiene cualquier disputa futura sobre daños.

**Root**: `Reservation` (`ReservationId`).

**Entidades internas**:

- `Inspection` (identidad propia: `inspectionId`; `type: CheckOut | CheckIn`, `odometer: Odometer`, `fuelLevel`, referencias a fotos vía `File`, `inspectedAt`, `inspectedBy` — referencia a `UserId` del Operador). Entidad porque cada inspección es un hecho histórico e inmutable una vez registrado, con su propia identidad citable en una disputa.
- `DamageReport` (identidad propia: `damageReportId`; descripción, severidad, referencia a fotos, `imputableToCustomer: boolean`, referencia a la `Inspection` que lo detectó). Entidad por la misma razón: es evidencia, no puede mutar tras creado, solo puede anexarse una resolución.

**Value Objects**: `DateRange`, `ReservationStatus` (`Draft`, `Confirmed`, `CheckedOut`, `CheckedIn`, `Closed`, `Cancelled`), `Money` (tarifa acordada, congelada al confirmar por RN-20), `PriceBreakdown` (compuesto de `baseAmount: Money` + `adjustments: PriceAdjustment[]`), `PriceAdjustment` (`kind: Extension | LateReturnPenalty | DamagePenalty | FuelDifference`, `amount: Money`, `reason`) — ver [01-BOUNDED_CONTEXTS.md §4.3](01-BOUNDED_CONTEXTS.md) sobre por qué esto **no** se llama `Charge` ni `Penalty` dentro de este agregado (esos términos pertenecen al Bounded Context Commerce por definición de glosario, [domain/02-LENGUAJE-UBICUO.md §6](../domain/02-LENGUAJE-UBICUO.md); `PriceAdjustment` es su homólogo en el lenguaje de Rental Operations, traducido explícitamente al emitir `ReservationCheckedIn.v1`).

**No contiene** (recordatorio explícito, ya fijado en [03-DOMINIO.md §3.1](../03-DOMINIO.md)): datos completos de `Customer` ni de `Vehicle`, solo `CustomerId`/`VehicleId`. Tampoco contiene el `AvailabilitySlot` (vive en Scheduling, referenciado indirectamente vía la ACL).

**Eventos**: `ReservationCreated.v1` (Draft), `ReservationConfirmed.v1`, `ReservationRejectedByAvailability.v1`, `ReservationCancelled.v1`, `ReservationCheckedOut.v1`, `ReservationRescheduled.v1`, `ExtensionRequested.v1`, `ExtensionApproved.v1`, `VehicleSwapped.v1`, `ReservationCheckedIn.v1`, `NoShowRegistered.v1`, `ReservationClosed.v1`. Detalle completo de payload y contrato en [06-DOMAIN_EVENTS.md](06-DOMAIN_EVENTS.md).

**Invariantes** (detalladas y numeradas en [07-INVARIANTS.md §1](07-INVARIANTS.md), resumidas aquí):

- No puede confirmarse sin que el `Vehicle` esté disponible en todo el `DateRange` (RN-01), verificado vía `AvailabilityService` en el momento exacto de confirmar, no solo al crear el `Draft` (regla de re-verificación explícita en [domain/03-PROCESOS.md §3](../domain/03-PROCESOS.md)).
- No puede solaparse con otra `Reservation` activa sobre el mismo `Vehicle` (RN-02) — protegido en última instancia por el exclusion constraint de `AvailabilitySlot` (§7), no solo por lógica de aplicación.
- `endDate > startDate` siempre (RN-03), validado por el propio VO `DateRange`, no por el agregado.
- Las transiciones de `ReservationStatus` siguen exactamente la máquina de estados de [08-STATE_MACHINES.md §1](08-STATE_MACHINES.md); no se permiten saltos.
- No puede pasar a `Confirmed` si el `Customer` referenciado no es elegible (documentación vigente, no bloqueado) — consultado vía puerto síncrono a `Customer`.
- No puede pasar a `Confirmed` si algún `AdditionalDriver` declarado para esta reserva no está `Validated`.
- Un `CheckOut` exige una `Inspection` de tipo `CheckOut` completa (odómetro + combustible + fotos) sin excepción (RN-13); un `CheckIn` exige una `Inspection` de tipo `CheckIn` comparada contra la de `CheckOut` (RN-14).
- Una extensión (`ExtensionRequested`/`Approved`) que colisiona con otra `Reservation` confirmada sobre el mismo `Vehicle` no puede aprobarse silenciosamente — exige `VehicleSwapped` o rechazo explícito (regla de negocio ya documentada como hotspot en [domain/04-EVENT-STORMING.md §10](../domain/04-EVENT-STORMING.md)).
- `Closed` solo es alcanzable después de que el evento `InvoiceIssued.v1` fue recibido (RN-22) — nunca antes.

**Transacciones**: cada comando (`create`, `confirm`, `checkOut`, `requestExtension`, `approveExtension`, `swapVehicle`, `checkIn`, `cancel`, `markNoShow`) es una transacción atómica sobre el agregado `Reservation` completo (incluyendo sus `Inspection`/`DamageReport` internos). La liberación/ocupación del `AvailabilitySlot` correlacionado ocurre en una transacción separada dentro del mismo comando de aplicación, pero como una llamada síncrona al puerto de Scheduling — no como una transacción distribuida (ver [09-DEPENDENCIES.md §2](09-DEPENDENCIES.md) sobre este patrón).

**Lifecycle**: máquina de estados completa en [08-STATE_MACHINES.md §1](08-STATE_MACHINES.md).

**Límites**: exactamente un `Vehicle` por `Reservation` en v1.0 (decisión ya fijada y no reabierta aquí, [03-DOMINIO.md §3.1](../03-DOMINIO.md); paquetes multi-vehículo quedan fuera de alcance, [domain/09-FUTURAS-CAPACIDADES.md](../domain/09-FUTURAS-CAPACIDADES.md)).

**Reglas de modificación**: Cliente/Agente de Reservas (creación, confirmación, cancelación, extensión), Operador de Sucursal (check-out, check-in, swap, no-show) — según el catálogo de casos de uso de [domain/06-CASOS-USO.md](../domain/06-CASOS-USO.md).

**Reglas de consistencia**: fuertemente consistente consigo mismo (incluidas sus entidades internas); eventualmente consistente hacia `Invoice` (Commerce), `Vehicle` (actualización informativa de estado), `Notifications` y `Reports` — todos vía eventos.

**Justificación de diseño**: la decisión de mantener `Reservation` como raíz (y no `Vehicle`) ya está justificada en [03-DOMINIO.md §3.1.1](../03-DOMINIO.md) y se hereda sin cambios: el invariante de no-solapamiento pertenece al compromiso (`Reservation`), no al recurso (`Vehicle`). Se evaluó (y se descartó) incluir `Charge`/`Penalty` como entidades reales dentro de `Reservation` en lugar del VO `PriceAdjustment` — se descartó porque esos términos pertenecen formalmente al Bounded Context Commerce (glosario), y darles el mismo nombre de clase aquí violaría la disciplina de lenguaje ubicuo que [domain/02-LENGUAJE-UBICUO.md §10](../domain/02-LENGUAJE-UBICUO.md) exige explícitamente.

---

## 12. `SecurityDeposit` (Commerce)

**Objetivo**: representar el monto retenido (no cobrado) como garantía frente a una `Reservation`.

**Responsabilidad**: proteger que la liberación/retención nunca exceda el monto originalmente retenido, y que toda retención quede vinculada a una razón (`PriceAdjustment` traducido, o referencia directa a un `DamageReport`).

**Root**: `SecurityDeposit` (`SecurityDepositId`).

**Entidades internas**: ninguna — es un agregado deliberadamente pequeño.

**Value Objects**: `Money` (monto retenido), `DepositStatus` (`Held`, `ReleasedFully`, `RetainedPartially`, `RetainedFully`), `GatewayHoldReference` (referencia opaca a la autorización en la pasarela, si el mecanismo es una preautorización de tarjeta y no efectivo).

**Eventos**: `SecurityDepositHeld.v1`, `SecurityDepositReleased.v1`, `SecurityDepositPartiallyRetained.v1`.

**Invariantes**:

- El monto retenido total (`RetainedPartially` + `RetainedFully`) nunca puede exceder el `Money` originalmente `Held`.
- No puede liberarse (`Released`) ni retenerse (`Retained`) dos veces sobre el mismo `SecurityDeposit` — una vez resuelto (`ReleasedFully`, `RetainedPartially` o `RetainedFully`), el agregado es terminal.
- Una retención parcial o total exige una razón trazable (idealmente una referencia a un `DamageReport` o un `PriceAdjustment` de tipo penalidad) — el mecanismo (`SecurityDeposit`) nunca decide _por sí mismo_ que hay daño; solo ejecuta la decisión ya tomada por `Reservation`/`Invoice`.

**Transacciones**: retención (al confirmar, si la política lo exige), liberación/retención (al check-in) — cada una atómica sobre el agregado.

**Lifecycle**: `Held` → `ReleasedFully` | `RetainedPartially` | `RetainedFully` (terminal).

**Límites**: no decide el monto de la retención por daño (eso lo calcula `PricingService` en Rental Operations); solo ejecuta y registra el movimiento financiero.

**Reglas de modificación**: disparado por el caso de uso de aplicación de `Reservations` al confirmar (retención) y al hacer check-in (liberación/retención), a través del puerto que `Commerce` publica — `Reservation` nunca importa el agregado `SecurityDeposit` directamente.

**Reglas de consistencia**: eventualmente consistente respecto a `Reservation` (se crea/resuelve reaccionando a `ReservationConfirmed.v1`/`ReservationCheckedIn.v1`).

**Justificación de diseño**: se evaluó modelar el depósito de garantía como un estado más dentro de `Payment` (alternativa: un `Payment` de tipo "hold" nunca capturado) y se descartó — un depósito de garantía tiene invariantes propios (no puede exceder lo retenido, resolución binaria terminal) y un vocabulario de negocio propio (RN-21) lo bastante distinto de una transacción de cobro estándar como para justificar un agregado separado; forzarlo dentro de `Payment` habría mezclado dos máquinas de estados no homogéneas en un mismo agregado.

---

## 13. `Payment` (Commerce)

**Objetivo**: representar una transacción de cobro procesada por una pasarela externa contra un `Charge` o una `Invoice`.

**Responsabilidad**: proteger la máquina de estados de un intento de cobro y garantizar idempotencia frente a reintentos de red o webhooks duplicados.

**Root**: `Payment` (`PaymentId`).

**Entidades internas**: ninguna.

**Value Objects**: `Money`, `PaymentMethod` (tarjeta, efectivo, transferencia, billetera digital — RN-24), `PaymentStatus` (`Requested`, `Authorized`, `Captured`, `Failed`, `Refunded`), `GatewayReference` (identificador opaco de la transacción en Stripe/Mercado Pago), `IdempotencyKey`.

**Eventos**: `PaymentSucceeded.v1` (contrato v1 ya fijado, [03-DOMINIO.md §4](../03-DOMINIO.md)), `PaymentFailed.v1` (contrato v1), `PaymentRefunded.v1`.

**Invariantes**:

- Un `Payment` con la misma `IdempotencyKey` no puede procesarse dos veces — invariante crítico para evitar doble cobro ante reintento de red ([08-API-CONTRACTS.md §7](../08-API-CONTRACTS.md)).
- Las transiciones de `PaymentStatus` son estrictamente unidireccionales dentro de un intento (`Requested → Authorized → Captured`, o `→ Failed` desde cualquier punto antes de `Captured`); un `Payment` `Captured` solo puede transicionar a `Refunded`, nunca de vuelta a `Authorized`.
- El resultado de un webhook de proveedor nunca se aplica directamente: se verifica firma/autenticidad primero ([11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md)) y se traduce a un comando de dominio sobre este agregado — el payload crudo del proveedor nunca muta el agregado directamente.
- Un `Payment` fallido después de que el `Vehicle` ya fue entregado no revierte ningún estado de `Reservation` (RN-25) — este agregado no tiene autoridad para revertir un hecho físico ya ocurrido en otro Bounded Context; su fallo solo se traduce en gestión de cobranza posterior.

**Transacciones**: cada transición de estado es una transacción atómica sobre el `Payment`.

**Lifecycle**: ver máquina de estados en [08-STATE_MACHINES.md §3](08-STATE_MACHINES.md).

**Límites**: no conoce el detalle de qué originó el cobro (una línea de alquiler, una penalidad) más allá de una referencia opaca a `Charge`/`Invoice` — esa semántica de negocio vive en `Invoice`/`Reservation`, no aquí.

**Reglas de modificación**: iniciado por el caso de uso de aplicación de `Invoices`/`Reservations` al necesitar cobrar; resuelto por el adaptador de `PaymentGatewayPort` (webhook traducido) o por registro manual (cobro presencial en efectivo).

**Reglas de consistencia**: eventualmente consistente respecto a `Invoice` (correlación por referencia, nunca transacción compartida).

**Justificación de diseño**: se evaluó fusionar `Payment` e `Invoice` en un único agregado (alternativa: la factura "sabe" si está pagada como un campo propio) y se descartó — una `Invoice` puede tener múltiples intentos de `Payment` (fallidos y luego exitosos, o pagos parciales), y forzar esa cardinalidad 1:N dentro de un único agregado con invariantes de emisión fiscal (numeración, inmutabilidad del comprobante) mezclaría dos razones de cambio distintas y dos frecuencias de escritura distintas (una `Invoice` se emite una vez; un `Payment` puede reintentarse varias veces).

---

## 14. `Invoice` (Commerce)

**Objetivo**: representar el comprobante fiscal/comercial emitido sobre una `Reservation` cerrada.

**Responsabilidad**: proteger la integridad e inmutabilidad del comprobante emitido, y consolidar las líneas de cobro (`Charge`) que lo componen.

**Root**: `Invoice` (`InvoiceId`).

**Entidades internas**: `Charge` (identidad propia: `chargeId`; `kind` — `RentalFee`, `Extension`, `Penalty`, `Damage`, `Fuel` —, `amount: Money`, `description`). Es la traducción, ya en el lenguaje de Commerce, de los `PriceAdjustment` de `Reservation` (ver ACL en [01-BOUNDED_CONTEXTS.md §4.3](01-BOUNDED_CONTEXTS.md)). Entidad porque cada línea de cobro es un hecho fiscal individualmente citable (una línea de una factura no se "fusiona" con otra tras emitida).

**Value Objects**: `InvoiceNumber` (numeración fiscal correlativa, formato dependiente de país — RN-23), `TaxDetails` (impuestos aplicados, dependiente de país), `InvoiceStatus` (`Issued`, `Voided`).

**Eventos**: `InvoiceIssued.v1` (contrato v1 ya fijado), `InvoiceVoided.v1`.

**Invariantes**:

- Una `Invoice` solo puede emitirse una vez por `Reservation` (relación 1:1 entre `ReservationId` y `Invoice` emitida, salvo el caso excepcional de anulación + reemisión, que crea una nueva `Invoice` referenciando la anulada).
- Un `Charge` no puede editarse ni eliminarse tras la emisión — una corrección exige `InvoiceVoided.v1` seguido de una nueva `Invoice` (integridad fiscal: no se "parchea" un comprobante ya emitido).
- La suma de `Charge.amount` es la única fuente del total facturado — no existe un campo `total` editable de forma independiente.
- Toda `Reservation` debe tener su `Invoice` emitida antes de poder pasar a `Closed` (RN-22) — la responsabilidad de esperar este hecho es de `Reservation` (consultando/reaccionando al evento), no de `Invoice` bloqueando nada activamente.

**Transacciones**: emisión (una única transacción que crea `Invoice` + todos sus `Charge` atómicamente a partir del payload de `ReservationCheckedIn.v1`), anulación — cada una atómica.

**Lifecycle**: `Issued` → `Voided` (excepcional, terminal — una vez anulada, no vuelve a `Issued`).

**Límites**: no conoce el estado de cobro (`Payment` es un agregado separado, correlacionado por `invoiceId` sin que `Invoice` necesite saber si fue pagada para existir como documento fiscal válido).

**Reglas de modificación**: disparada automáticamente por el listener que reacciona a `ReservationCheckedIn.v1`; la anulación requiere Responsable Comercial/Financiero.

**Reglas de consistencia**: eventualmente consistente respecto a `Reservation` (createda en una transacción separada, coordinada por evento) y respecto a `Payment` (correlación por ID, nunca por transacción compartida).

**Justificación de diseño**: ver §13 sobre por qué `Invoice` y `Payment` son agregados separados. Adicionalmente, se evaluó (y descartó) que `Invoice` genere directamente el PDF dentro del propio agregado — la generación de PDF es una operación de infraestructura (vía `Files`) disparada por el caso de uso de aplicación tras persistir el agregado, nunca una responsabilidad del dominio de `Invoice` (el dominio no sabe qué es un PDF).

---

## 15. `File` (Support)

**Objetivo**: representar un archivo almacenado (foto de vehículo, documento de cliente, PDF de factura) con su metadata.

**Responsabilidad**: proteger la integridad referencial mínima (qué tipo de contenido es, a qué agregado de negocio pertenece conceptualmente por convención de uso, no por relación modelada) y mediar el acceso a través de URLs firmadas de vida corta.

**Root**: `File` (`FileId`).

**Entidades internas**: ninguna.

**Value Objects**: `StorageRef` (puntero opaco al objeto en el proveedor de storage — nunca una URL pública permanente), `ContentType`, `UploadStatus` (`Uploaded`, `Deleted`).

**Eventos**: `FileUploaded.v1`, `FileDeleted.v1`.

**Invariantes**:

- Un `File` en `Deleted` no puede generar una nueva URL firmada.
- `StorageRef` es inmutable tras la creación (subir un archivo nuevo crea un `File` nuevo, nunca sobrescribe el contenido de uno existente — necesario para la integridad de evidencia fotográfica de inspecciones, [domain/07-EXCEPCIONES.md §9](../domain/07-EXCEPCIONES.md)).

**Transacciones**: registro de metadata tras subida exitosa, eliminación lógica — cada una atómica.

**Lifecycle**: `Uploaded` → `Deleted` (el contenido físico puede purgarse por política de retención separada del ciclo de vida del agregado de metadata).

**Límites**: no contiene el binario (vive en el proveedor de storage, [11-INTEGRACIONES.md §11](../11-INTEGRACIONES.md)); no conoce reglas de negocio de quien lo referencia (un `VehicleDocument` o una `Inspection` referencian un `FileId`, `File` no sabe qué es un `VehicleDocument`).

**Reglas de modificación**: cualquier módulo consumidor con permiso, a través del puerto `StorageProviderPort`.

**Reglas de consistencia**: referenciado por ID desde `Vehicle`, `Customer`, `Reservation`, `Invoice` — nunca una relación rica, siempre un `fileId` opaco.

**Justificación de diseño**: se evaluó no modelar `File` como agregado de dominio en absoluto (tratarlo como infraestructura pura sin modelo de dominio) y se descartó parcialmente — aunque el contenido es infraestructura, la _metadata_ (quién subió qué, cuándo, su estado de eliminación) sí tiene reglas de negocio mínimas (inmutabilidad de evidencia) que justifican un agregado ligero en vez de un CRUD sin reglas.

---

## 16. `Notification` (Support)

**Objetivo**: representar el envío de un mensaje a un destinatario por un canal, como consecuencia de un evento de negocio.

**Responsabilidad**: proteger la máquina de estados de entrega y la política de reintento/canal alternativo (RN-34).

**Root**: `Notification` (`NotificationId`).

**Entidades internas**: ninguna.

**Value Objects**: `Channel` (`WhatsApp`, `Email`, `SMS`, `Push`), `Recipient`, `NotificationStatus` (`Pending`, `Sent`, `Delivered`, `Failed`), `NotificationKind` (`Confirmation`, `Reminder`, `Receipt`, `Alert` — distinción de negocio ya fijada en [domain/02-LENGUAJE-UBICUO.md §8](../domain/02-LENGUAJE-UBICUO.md)).

**Eventos**: `NotificationSent.v1`, `NotificationDelivered.v1` (traducido desde `WhatsAppMessageDelivered.v1` u homólogo de otro proveedor), `NotificationFailed.v1`.

**Invariantes**:

- Un fallo de envío por el canal preferido debe intentar un canal alternativo antes de marcarse `Failed` de forma terminal (RN-34) — este agregado modela ese reintento como una progresión de estado, no como un `Notification` nuevo por canal (mismo mensaje, distintos intentos).
- Una `Notification` de `NotificationKind = Confirmation` que agota todos los canales automáticos sin éxito no puede quedar silenciosamente `Failed`: debe generar una señal visible para escalamiento humano (Agente de Reservas) — regla de negocio explícita en [domain/07-EXCEPCIONES.md §4](../domain/07-EXCEPCIONES.md).

**Transacciones**: creación, actualización de estado de entrega — cada una atómica.

**Lifecycle**: `Pending` → `Sent` → `Delivered` | `Failed` (con reintento interno antes de `Failed` terminal).

**Límites**: no contiene la lógica de negocio de _qué_ dice el mensaje más allá de una referencia a plantilla — el contenido específico de negocio (p. ej. detalles de una reserva) se resuelve componiendo el mensaje a partir del payload del evento que lo originó, no editando el dominio de `Notification`.

**Reglas de modificación**: creado por listeners que reaccionan a eventos de otros BC (`ReservationConfirmed.v1`, `InvoiceIssued.v1`, etc.); su estado de entrega lo actualiza el adaptador de canal correspondiente.

**Reglas de consistencia**: puramente reactivo (eventual por diseño) respecto a todos los demás Bounded Contexts.

**Justificación de diseño**: se evaluó no modelarlo como agregado con invariantes (tratarlo como un log de envíos sin reglas) y se descartó porque la política de reintento/escalamiento (RN-34 y la regla de confirmación crítica) es una regla de negocio real que debe protegerse en algún lugar explícito y testeable, no dispersarse como lógica ad-hoc en un adaptador de infraestructura.

---

## 17. `AuditLogEntry` (Support)

**Objetivo**: registrar de forma inmutable qué actor hizo qué y cuándo.

**Responsabilidad**: garantizar append-only estricto — es, por diseño, el agregado con menos comportamiento de todo el modelo.

**Root**: `AuditLogEntry` (`AuditLogEntryId`).

**Entidades internas**: ninguna.

**Value Objects**: `ActorRef` (`userId` o identificador de actor de sistema), `Action` (nombre del evento de dominio origen), `Subject` (tipo + ID del agregado afectado), `Timestamp`, `Payload` (snapshot mínimo relevante, nunca el agregado completo).

**Eventos**: este agregado no emite eventos propios — es, en sí mismo, un consumidor terminal (un listener que reacciona a eventos de todos los demás Bounded Contexts, ver [01-BOUNDED_CONTEXTS.md §1](01-BOUNDED_CONTEXTS.md)).

**Invariantes**:

- Un `AuditLogEntry` no admite `UPDATE` ni `DELETE` desde la aplicación de negocio, sin excepción (ver [09-SEGURIDAD.md §4](../09-SEGURIDAD.md)) — es el único agregado de todo el modelo cuyo único invariante es su propia inmutabilidad total tras creación.

**Transacciones**: creación — una única operación de inserción, nunca una actualización.

**Lifecycle**: `Created` (estado único y terminal; no hay transición de estado posible).

**Límites**: no interpreta ni valida el contenido de negocio del evento que registra — solo lo transcribe de forma estructurada.

**Reglas de modificación**: ninguna — es append-only por regla de plataforma, no solo por convención de código.

**Reglas de consistencia**: eventualmente consistente por diseño respecto a todo el resto del sistema (un `AuditLogEntry` siempre se crea _después_ del hecho que audita).

**Justificación de diseño**: se evaluó implementar auditoría vía triggers de base de datos (alternativa considerada y descartada explícitamente en [04-MODELO-DATOS.md §7](../04-MODELO-DATOS.md)) — se prefirió que "qué se audita" sea una decisión de dominio/aplicación testeable, no lógica SQL oculta; por eso `AuditLogEntry` existe como agregado de dominio propio y no como efecto secundario invisible de una escritura en otra tabla.
