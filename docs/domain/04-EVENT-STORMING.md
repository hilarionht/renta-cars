# 04 — Event Storming

Este documento consolida el resultado de un ejercicio de Event Storming sobre el negocio de alquiler de vehículos: **comandos** (intención de un actor), **eventos de dominio** (hechos consumados, siempre en pasado), **políticas** (reglas del tipo "cuando ocurre X, automáticamente se dispara Y") y el actor/agregado involucrado en cada uno.

Los eventos formalizados como contrato técnico entre módulos ya están fijados en [03-DOMINIO.md §4](../03-DOMINIO.md) — esta tabla es su superset de negocio: incluye también eventos que hoy no cruzan bounded context (y por tanto no están en el contrato técnico) pero que son relevantes para entender el negocio completo.

## 1. Convención de lectura

- **Comando**: verbo imperativo, lo dispara un actor (`ConfirmarReserva`).
- **Evento**: verbo en pasado, es un hecho ya ocurrido e inmutable (`ReservaConfirmada`).
- **Política**: regla reactiva ("cuando ocurre `X`, el sistema/actor ejecuta `Y`").
- Los eventos marcados **(contrato v1)** son los ya formalizados en [03-DOMINIO.md §4](../03-DOMINIO.md) con versión de payload; el resto son eventos de negocio identificados en este ejercicio, candidatos a formalizarse cuando la implementación los necesite cruzar un límite de módulo.

## 2. Línea de tiempo: Flota

| Comando | Actor | Agregado | Evento | Política disparada |
|---|---|---|---|---|
| RegistrarVehículo | Administrador de Empresa | Vehicle | `VehículoRegistrado` | Ninguna aún — el vehículo no está disponible hasta habilitarse |
| CargarDocumentaciónVehículo | Administrador de Empresa | Vehicle | `DocumentaciónVehículoCargada` | — |
| HabilitarVehículo | Administrador de Empresa | Vehicle | `VehículoHabilitado` | Aparece en Calendar como potencialmente disponible |
| CambiarEstadoVehículo | Responsable de Mantenimiento | Vehicle | `VehicleStatusChanged.v1` **(contrato v1)** | Si nuevo estado es `Maintenance`/`OutOfService` → bloquear Availability Slot futuro; consumido también por Reports |
| ProgramarMantenimiento | Responsable de Mantenimiento | Vehicle | `MantenimientoProgramado` | Bloquea disponibilidad del Vehicle para el rango programado |
| RegistrarDañoVehículo | Operador de Sucursal | Vehicle | `DañoRegistrado` | Puede disparar `ProgramarMantenimiento` si el daño afecta la operatividad |
| CompletarMantenimiento | Responsable de Mantenimiento | Vehicle | `MantenimientoCompletado` | Libera el Vehicle a `Available` si pasa la verificación |

## 3. Línea de tiempo: Cliente

| Comando | Actor | Agregado | Evento | Política disparada |
|---|---|---|---|---|
| RegistrarCliente | Cliente / Agente de Reservas | Customer | `ClienteRegistrado` | — |
| CargarDocumentoIdentidad | Cliente | Customer | `DocumentoIdentidadCargado` | Si viene de OCR, requiere confirmación explícita antes de marcar el dato como verdad de negocio |
| ValidarDocumentación | Agente de Reservas | Customer | `DocumentaciónClienteValidada` | Habilita al Customer para pasar Reservations a `Confirmed` |
| RegistrarConductorAdicional | Cliente / Agente de Reservas | Customer | `ConductorAdicionalRegistrado` | Debe validarse antes del Check-out asociado |
| MarcarDocumentoVencido | Sistema (job de vigencia) | Customer | `DocumentoClienteVencido` | Bloquea nuevas confirmaciones de Reservation hasta renovar |

## 4. Línea de tiempo: Cotización y Reserva

| Comando | Actor | Agregado | Evento | Política disparada |
|---|---|---|---|---|
| SolicitarCotización | Cliente | — (consulta, no agregado) | `CotizaciónGenerada` | — |
| CrearReserva | Cliente / Agente de Reservas | Reservation | `ReservaCreada` (estado `Draft`) | — |
| ConfirmarReserva | Cliente / Agente de Reservas | Reservation | `ReservationConfirmed.v1` **(contrato v1)** | Notifications envía confirmación; Reports registra la reserva; Calendar consolida el Availability Slot |
| RechazarReserva (por no disponibilidad) | Motor de Disponibilidad | Reservation | `ReservaRechazadaPorDisponibilidad` | Se ofrece alternativa al Cliente |
| CancelarReserva | Cliente / Agente de Reservas / Operador | Reservation | `ReservationCancelled.v1` **(contrato v1)** | Libera Availability Slot; Notifications informa; si aplica, se calcula `Penalty` |
| ReprogramarReserva | Cliente / Agente de Reservas | Reservation | `ReservaReprogramada` | Recalcula Rate; actualiza Availability Slot |

## 5. Línea de tiempo: Entrega y Devolución

| Comando | Actor | Agregado | Evento | Política disparada |
|---|---|---|---|---|
| RealizarCheckOut | Operador de Sucursal | Reservation | `ReservationCheckedOut.v1` **(contrato v1)** | Vehicles actualiza estado interno vía puerto; Notifications informa inicio de alquiler |
| RegistrarInspecciónEntrega | Operador de Sucursal | Reservation | `InspecciónEntregaRegistrada` | Establece línea base para comparar en el Check-in |
| SolicitarExtensión | Cliente | Reservation | `ExtensiónSolicitada` | Verifica disponibilidad contigua; si colisiona, dispara `VehicleSwapOfrecido` o rechazo |
| AprobarExtensión | Agente de Reservas / Operador | Reservation | `ExtensiónAprobada` | Recalcula Rate y actualiza Availability Slot |
| CambiarVehículoDeReserva | Operador de Sucursal | Reservation | `VehículoDeReservaCambiado` | Libera Availability Slot del vehículo original; ocupa el del nuevo |
| RealizarCheckIn | Operador de Sucursal | Reservation | `ReservationCheckedIn.v1` **(contrato v1)** | Dispara `EmitirFactura`; Notifications informa cierre |
| RegistrarInspecciónDevolución | Operador de Sucursal | Reservation | `InspecciónDevoluciónRegistrada` | Si hay diferencia vs. línea base → `DañoRegistrado` |
| RegistrarDevoluciónTardía | Sistema / Operador de Sucursal | Reservation | `DevoluciónTardíaDetectada` | Calcula y aplica `Penalty` por tardanza |
| MarcarNoShow | Operador de Sucursal | Reservation | `NoShowRegistrado` | Aplica política de cancelación/penalidad por no presentación; libera Availability Slot |

## 6. Línea de tiempo: Comercial y Financiero

| Comando | Actor | Agregado | Evento | Política disparada |
|---|---|---|---|---|
| CobrarAnticipoOGarantía | Cliente / Sistema | Payment | `AnticipoGarantíaCobrado` | Habilita continuar el flujo de confirmación si la política lo exige |
| ProcesarPago | Cliente / Pasarela de Pago | Payment | `PaymentSucceeded.v1` **(contrato v1)** | Invoices concilia el cobro; Notifications envía comprobante; Reports actualiza ingresos |
| RechazarPago | Pasarela de Pago | Payment | `PaymentFailed.v1` **(contrato v1)** | Notifications informa al Cliente; según política, bloquea Check-out hasta resolver |
| LiberarGarantía | Operador de Sucursal / Sistema | Payment | `GarantíaLiberada` | Se ejecuta tras Check-in sin daños ni pendientes |
| RetenerGarantíaParcial | Responsable Comercial/Financiero | Payment | `GarantíaRetenidaParcialmente` | Se asocia a un `Penalty` o `DañoRegistrado` específico |
| EmitirFactura | Responsable Comercial/Financiero / Sistema | Invoice | `InvoiceIssued.v1` **(contrato v1)** | Notifications envía comprobante; Payments concilia contra la factura |
| RegistrarDisputaDeCobro | Cliente / Responsable Comercial/Financiero | Payment | `DisputaDeCobroRegistrada` | Ver excepción dedicada en [07-EXCEPCIONES.md](07-EXCEPCIONES.md) |

## 7. Línea de tiempo: Comunicación

| Comando | Actor | Agregado | Evento | Política disparada |
|---|---|---|---|---|
| EnviarNotificación | Motor de Notificaciones | — | `NotificaciónEnviada` | — |
| ConfirmarEntregaDeNotificación | WhatsApp / Email / SMS (proveedor) | — | `WhatsAppMessageDelivered.v1` | Actualiza estado de entrega para trazabilidad/soporte |
| RegistrarFalloDeEnvío | Motor de Notificaciones | — | `NotificaciónFallida` | Reintenta por canal alternativo según política (ver [07-EXCEPCIONES.md](07-EXCEPCIONES.md)) |

## 8. Eventos ya formalizados como contrato técnico entre módulos

Repetidos aquí por completitud — el detalle y los consumidores actuales están en [03-DOMINIO.md §4](../03-DOMINIO.md):

- `ReservationConfirmed.v1`
- `ReservationCancelled.v1`
- `ReservationCheckedOut.v1`
- `ReservationCheckedIn.v1`
- `InvoiceIssued.v1`
- `PaymentSucceeded.v1`
- `PaymentFailed.v1`
- `VehicleStatusChanged.v1`
- `UserCreated.v1`

## 9. Políticas transversales identificadas

Estas políticas no pertenecen a un único proceso, sino que actúan como reglas reactivas de negocio que cruzan varios flujos:

| Política | Disparador | Efecto |
|---|---|---|
| Bloqueo automático por documentación vencida | `DocumentoClienteVencido` | Ninguna Reservation de ese Customer puede pasar a `Confirmed` hasta resolverse |
| Bloqueo automático por mantenimiento | `VehicleStatusChanged.v1` (a `Maintenance`/`OutOfService`) | El Vehicle desaparece de resultados de disponibilidad futura hasta volver a `Available` |
| Penalización automática por tardanza | `DevoluciónTardíaDetectada` | Se calcula `Penalty` según tabla de tarifas por hora/día de exceso, configurable por Company |
| Recordatorio proactivo antes de vencimiento | Job temporal (no evento de negocio) sobre `Reservation` en `Confirmed` | Se dispara `NotificaciónEnviada` tipo `Reminder` un tiempo configurable antes del Check-out |
| Liberación de disponibilidad ante cancelación/no-show | `ReservationCancelled.v1`, `NoShowRegistrado` | El Availability Slot se libera inmediatamente para nuevas reservas |

## 10. Hotspots identificados durante el ejercicio

Zonas de fricción o decisión de negocio no trivial, marcadas explícitamente para que no se pierdan al pasar a modelado táctico (Fase 2):

- **Extensión que colisiona con otra reserva**: el negocio prioriza el invariante de no-solapamiento sobre la conveniencia del cliente actual — requiere Vehicle Swap o rechazo, nunca "romper" la regla (ver [03-PROCESOS.md §7](03-PROCESOS.md)).
- **Pago fallido después de Check-out**: el vehículo ya está en poder del Cliente cuando se detecta el fallo de cobro — el negocio no puede "deshacer" la entrega, así que la política debe resolverse como gestión de cobranza posterior, no como reversión de estado (ver [07-EXCEPCIONES.md](07-EXCEPCIONES.md)).
- **OCR como sugerencia, nunca como verdad automática**: decisión de negocio explícita para evitar que un error de reconocimiento óptico contamine datos legales del Customer sin supervisión humana.
- **Cuándo exactamente se "cierra" una reserva**: el negocio exige que `Closed` solo ocurra después de `InvoiceIssued.v1`, no en el momento del Check-in — evita reservas cerradas sin comprobante fiscal asociado.
