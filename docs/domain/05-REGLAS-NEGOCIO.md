# 05 — Reglas de Negocio

Este documento consolida las reglas de negocio del alquiler de vehículos. Cada regla se clasifica en dos dimensiones independientes:

**Por criticidad:**
- 🔴 **Crítica**: su violación pone en riesgo la integridad operativa, legal o financiera del negocio. No es negociable ni configurable — es un invariante.
- 🟡 **Importante**: afecta la calidad del servicio o la rentabilidad, pero su incumplimiento puntual no compromete la viabilidad del negocio.
- 🟢 **Opcional**: mejora la experiencia u optimiza la operación, pero el negocio funciona sin ella.

**Por alcance:**
- **Universal**: aplica igual en cualquier Company, Branch o país donde opere la plataforma.
- **Configurable**: cada Company decide su propio valor/política dentro de un marco común.
- **Dependiente de país/legislación**: varía porque una norma externa (legal, fiscal, de tránsito) lo exige, no por preferencia comercial.

## 1. Reglas de disponibilidad y reserva

| # | Regla | Criticidad | Alcance |
|---|---|---|---|
| RN-01 | No puede confirmarse una Reservation si el Vehicle no está disponible en todo el Date Range solicitado. | 🔴 Crítica | Universal |
| RN-02 | Dos Reservations activas no pueden solaparse sobre el mismo Vehicle. | 🔴 Crítica | Universal |
| RN-03 | `endDate` de una Reservation siempre debe ser posterior a `startDate`. | 🔴 Crítica | Universal |
| RN-04 | Un Vehicle en estado `Maintenance` u `OutOfService` no puede ofrecerse como disponible, ni completar un Check-out. | 🔴 Crítica | Universal |
| RN-05 | Una Reservation `Draft` no bloquea disponibilidad de forma indefinida: expira tras un tiempo configurable si no se confirma. | 🟡 Importante | Configurable (tiempo de expiración por Company) |
| RN-06 | El tiempo mínimo de antelación para reservar (p. ej. no permitir reservar para "dentro de 10 minutos") es definible por Company. | 🟢 Opcional | Configurable |
| RN-07 | Una reserva corporativa puede reservar múltiples vehículos bajo una misma cuenta, pero cada uno constituye una Reservation independiente (ver [03-DOMINIO.md §7](../03-DOMINIO.md): paquetes multi-vehículo quedan fuera de v1.0). | 🟡 Importante | Universal (para v1.0) |

## 2. Reglas de cliente y documentación

| # | Regla | Criticidad | Alcance |
|---|---|---|---|
| RN-08 | Un Customer con documento de identidad o licencia de conducir vencidos no puede asociarse a una Reservation en estado `Confirmed`. | 🔴 Crítica | Universal (el requisito legal de licencia vigente para conducir aplica en todo mercado, aunque el documento concreto exigido varía) |
| RN-09 | Un Conductor Adicional no declarado antes del Check-out no puede conducir el vehículo con cobertura de seguro válida. | 🔴 Crítica | Dependiente de país/aseguradora — la exigencia de declaración previa es una condición de póliza, no una preferencia de la empresa de alquiler |
| RN-10 | La edad mínima para alquilar (y, a veces, para conducir ciertas categorías de vehículo) está sujeta a normativa local y/o política de aseguradora. | 🔴 Crítica | Dependiente de país/legislación |
| RN-11 | Un cliente corporativo puede tener múltiples Conductores Adicionales activos simultáneamente sin límite de negocio universal; el límite, si existe, es contractual por Company. | 🟢 Opcional | Configurable |
| RN-12 | Los datos extraídos por OCR de un documento nunca se consideran verdad de negocio sin confirmación humana explícita. | 🔴 Crítica | Universal (decisión de arquitectura ya fijada en [11-INTEGRACIONES.md §8](../11-INTEGRACIONES.md), heredada aquí como regla de negocio) |

## 3. Reglas de entrega y devolución

| # | Regla | Criticidad | Alcance |
|---|---|---|---|
| RN-13 | Todo Check-out requiere inspección de estado del vehículo y registro de Odometer, sin excepción. | 🔴 Crítica | Universal |
| RN-14 | Todo Check-in requiere inspección de estado del vehículo y comparación contra la línea base del Check-out. | 🔴 Crítica | Universal |
| RN-15 | Una devolución tardía genera una Penalty, calculada según una tabla de tarifas por hora/día de exceso. | 🟡 Importante | Configurable (la tabla de tarifas es propia de cada Company) |
| RN-16 | Existe una tolerancia de gracia (p. ej. 30-60 minutos) antes de que una devolución se considere tardía. | 🟢 Opcional | Configurable |
| RN-17 | Un daño detectado en Check-in que no estaba presente en Check-out genera un Damage Report y, si corresponde, una Penalty. | 🔴 Crítica | Universal (el mecanismo es universal; el monto de la penalidad es configurable) |
| RN-18 | El combustible debe devolverse en el mismo nivel registrado en el Check-out (o política equivalente "tanque lleno"); la diferencia genera un Charge. | 🟡 Importante | Configurable |
| RN-19 | Un No-show (Cliente no se presenta al Check-out) se gestiona según la misma política de cancelación tardía, salvo que la Company defina una política de No-show distinta y más estricta. | 🟡 Importante | Configurable |

## 4. Reglas comerciales y financieras

| # | Regla | Criticidad | Alcance |
|---|---|---|---|
| RN-20 | El precio de una Reservation se calcula con la Rate vigente al momento de la confirmación, no al momento de la consulta inicial. | 🟡 Importante | Universal |
| RN-21 | Un Security Deposit se retiene, no se cobra, y se libera total o parcialmente al Check-in según haya o no Penalty/Damage Report asociado. | 🔴 Crítica | Universal (el mecanismo); el monto y si aplica o no es configurable |
| RN-22 | Toda Invoice debe emitirse antes de que la Reservation pase a `Closed`. | 🔴 Crítica | Universal |
| RN-23 | El formato, numeración y tipo de comprobante fiscal de una Invoice se rige por la normativa tributaria del país donde opera la Branch. | 🔴 Crítica | Dependiente de país/legislación |
| RN-24 | Los métodos de pago aceptados (tarjeta, efectivo, transferencia, billeteras digitales) son configurables por Company y pueden variar por Branch/país. | 🟢 Opcional | Configurable |
| RN-25 | Un cobro fallido después de que el vehículo ya fue entregado no revierte el Check-out; se gestiona como cobranza pendiente, nunca como reversión de un hecho físico ya ocurrido. | 🔴 Crítica | Universal |
| RN-26 | La política de cancelación (plazos sin penalidad, porcentaje de penalidad según anticipación) es definida por cada Company. | 🟡 Importante | Configurable |

## 5. Reglas de flota y mantenimiento

| # | Regla | Criticidad | Alcance |
|---|---|---|---|
| RN-27 | Un Vehicle no puede habilitarse (`Available`) sin documentación legal vigente cargada (propiedad, seguro, permisos de circulación). | 🔴 Crítica | Universal (el requisito); los documentos concretos exigidos son dependientes de país |
| RN-28 | El cambio de Vehicle Status es responsabilidad exclusiva del agregado Vehicle — ningún otro proceso decide la disponibilidad estructural de un vehículo. | 🔴 Crítica | Universal (ya fijado como invariante técnico en [03-DOMINIO.md §3.2](../03-DOMINIO.md); aquí se documenta su origen de negocio: solo Mantenimiento tiene la competencia para declarar un vehículo apto o no apto) |
| RN-29 | El mantenimiento preventivo se programa según umbrales de kilometraje y/o tiempo transcurrido, definidos por Company (y a veces por fabricante del vehículo). | 🟡 Importante | Configurable |
| RN-30 | Un Vehicle con mantenimiento programado que colisiona con una Reservation ya confirmada requiere resolución explícita (reprogramar mantenimiento u ofrecer Vehicle Swap), nunca silenciar el conflicto. | 🔴 Crítica | Universal |
| RN-31 | Un vehículo no puede pertenecer a más de una Branch simultáneamente (scoping físico de flota). | 🔴 Crítica | Universal (ya fijado en [03-DOMINIO.md §3.2](../03-DOMINIO.md)) |

## 6. Reglas de notificación y comunicación

| # | Regla | Criticidad | Alcance |
|---|---|---|---|
| RN-32 | Toda confirmación, cancelación y comprobante de pago debe notificarse al Customer por al menos un canal. | 🟡 Importante | Universal |
| RN-33 | El canal preferido de notificación (WhatsApp, Email, SMS) es configurable por Customer y/o por Company. | 🟢 Opcional | Configurable |
| RN-34 | Un fallo de envío por el canal preferido debe intentar un canal alternativo antes de considerarse una notificación no entregada. | 🟡 Importante | Configurable (qué canal alternativo y cuántos reintentos) |

## 7. Cómo se resuelven los conflictos entre reglas configurables y críticas

Ninguna configuración a nivel de Company puede relajar una regla 🔴 Crítica. Por ejemplo: una Company puede decidir que su ventana de cancelación sin penalidad sea de 24 o 48 horas (RN-26, configurable), pero ninguna Company puede configurar que se permitan Reservations solapadas (RN-02, crítica) "porque su operación es distinta". Cuando una empresa cliente de la plataforma solicite excepcionar una regla crítica, la respuesta correcta es cuestionar si realmente es la misma regla de negocio o si se trata de un caso de negocio distinto no cubierto todavía — nunca relajar el invariante para un tenant.

## 8. Reglas explícitamente fuera de alcance de v1.0

Heredado de [03-DOMINIO.md §7](../03-DOMINIO.md), documentado aquí desde la óptica de negocio:

- Reglas de precio dinámico basado en demanda (yield management).
- Reglas de mantenimiento predictivo (basado en telemetría/IoT).
- Reglas de reserva de múltiples vehículos como un único paquete comercial.

Estas no son reglas "canceladas": son reglas que el negocio aún no necesita formalizar porque la capacidad correspondiente no existe todavía (ver [09-FUTURAS-CAPACIDADES.md](09-FUTURAS-CAPACIDADES.md)).
