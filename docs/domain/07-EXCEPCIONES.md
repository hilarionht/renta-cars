# 07 — Excepciones del Negocio

Los procesos de [03-PROCESOS.md](03-PROCESOS.md) describen el camino esperado. Este documento describe **qué pasa cuando el camino esperado no ocurre** — porque en un negocio operativo real, las excepciones no son un caso raro: son parte cotidiana de la operación de una empresa de alquiler de vehículos.

Cada excepción indica: disparador, actor que la resuelve, resolución de negocio esperada, y si genera algún Charge/Penalty.

## 1. Cliente no se presenta (No-show)

**Disparador:** el Cliente no llega a realizar el Check-out en la fecha/hora pactada, y transcurre un margen de tolerancia sin contacto.

**Actor que resuelve:** Operador de Sucursal.

**Resolución de negocio:**
- Se marca la Reservation como No-show.
- Se libera el Availability Slot para que otro Cliente pueda reservar el Vehicle.
- Se aplica la política de penalidad configurada por la Company para No-show (puede ser equivalente a la de cancelación tardía o una política propia — ver RN-19 en [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md)).
- Si el Cliente se presenta tarde pero antes de que el Vehicle se reasigne, el negocio puede optar por permitir el Check-out igualmente (decisión operativa de la sucursal, no automática).

## 2. Vehículo averiado durante el alquiler

**Disparador:** el Cliente reporta una falla mecánica mientras el Vehicle está en su poder (`CheckedOut`).

**Actor que resuelve:** Operador de Sucursal, coordinando con Responsable de Mantenimiento y, si aplica, Proveedor de Servicios (asistencia en ruta).

**Resolución de negocio:**
- Se registra un Damage Report / falla, distinguiendo si la causa es desgaste normal, mal uso del Cliente, o defecto no imputable.
- Si el vehículo queda inoperable, el negocio debe resolver la continuidad del alquiler: Vehicle Swap (si hay unidad disponible) o suspensión del alquiler con ajuste comercial (no se factura el tiempo sin vehículo operativo).
- Si la causa es imputable al Cliente (mal uso), puede generar Penalty; si no lo es, no debe trasladarse costo al Cliente — esta distinción es una decisión de negocio caso a caso, no automatizable en su totalidad.
- El Vehicle pasa a `Maintenance`/`OutOfService` en cuanto se confirma la falla, incluso si la Reservation sigue activa a través de un Vehicle Swap.

## 3. Pago rechazado

**Disparador:** la Pasarela de Pago responde con `PaymentFailed.v1`.

**Actor que resuelve:** Cliente (reintenta o cambia método), Responsable Comercial/Financiero (si es post-entrega).

**Resolución de negocio, según el momento:**
- **Antes del Check-out**: el negocio puede optar por bloquear el Check-out hasta resolver el pago (política común cuando el pago es condición para confirmar), u ofrecer un método alternativo.
- **Después del Check-out**: el vehículo ya fue entregado — el fallo de pago **no revierte** el Check-out (RN-25). Se convierte en una gestión de cobranza: se notifica al Cliente, se reintenta, y si persiste, se activan las políticas de mora de la Company (posible bloqueo de futuras reservas del mismo Customer hasta regularizar).

## 4. WhatsApp (u otro canal) no enviado

**Disparador:** el proveedor de canal (WhatsApp Business, Email, SMS) falla en la entrega de una Notification.

**Actor que resuelve:** Motor de Notificaciones (automático), con escalamiento a Agente de Reservas si es crítico.

**Resolución de negocio:**
- Se reintenta por el mismo canal según política de reintentos.
- Si persiste el fallo, se intenta un canal alternativo (RN-34) — p. ej. si WhatsApp falla, se intenta Email.
- Para notificaciones críticas (confirmación de reserva, comprobante de pago), si todos los canales automáticos fallan, el negocio requiere que quede una señal visible para que un Agente de Reservas contacte manualmente al Cliente — una confirmación de reserva nunca puede quedar "silenciosamente no informada".

## 5. Doble reserva (intento de solapamiento)

**Disparador:** dos solicitudes de Reservation compiten por el mismo Vehicle en fechas solapadas, típicamente por condición de carrera entre el momento de cotizar y el de confirmar.

**Actor que resuelve:** Motor de Disponibilidad (bloquea automáticamente), Agente de Reservas (gestiona al cliente afectado).

**Resolución de negocio:**
- La regla RN-02 es innegociable: nunca se permite que ambas se confirmen.
- Quien confirma primero se queda con el Vehicle; a quien llega después se le ofrece alternativa (otro vehículo de la misma categoría, otra sucursal, u otras fechas).
- Si el Cliente que pierde el Vehicle ya había recibido una Quote o incluso una Reservation `Draft`, el negocio debe comunicarlo proactivamente, no dejar que lo descubra al llegar a la sucursal — es una situación que daña la confianza del Cliente si se gestiona mal, aunque técnicamente esté "resuelta" por el sistema.

## 6. Extensión de alquiler solicitada

**Disparador:** el Cliente, con el vehículo ya en su poder, solicita prolongar el período.

**Actor que resuelve:** Agente de Reservas u Operador de Sucursal.

**Resolución de negocio:**
- Si el Vehicle sigue disponible después del `endDate` actual, se aprueba y se recalcula el monto.
- Si colisiona con otra Reservation ya confirmada, el negocio no puede simplemente "estirar" la reserva — debe resolverse con Vehicle Swap o rechazo de la extensión (ver hotspot en [04-EVENT-STORMING.md §10](04-EVENT-STORMING.md)).
- Una extensión de último momento (el Cliente avisa después de la hora pactada de devolución) se trata como devolución tardía (RN-15) hasta que se formalice la extensión, no se asume aprobada retroactivamente.

## 7. Cambio de vehículo (Vehicle Swap)

**Disparador:** el Vehicle asignado deja de ser viable (avería, mantenimiento urgente, error de asignación) mientras la Reservation ya está `Confirmed` o `CheckedOut`.

**Actor que resuelve:** Operador de Sucursal.

**Resolución de negocio:**
- Se sustituye el Vehicle manteniendo el mismo Customer y compromiso comercial (mismo Rate salvo que el cambio implique otra categoría, en cuyo caso se ajusta el monto según política de la Company).
- Si el swap ocurre por causa imputable a la empresa (p. ej. el vehículo reservado nunca estuvo realmente disponible), el negocio debe evitar penalizar o encarecer al Cliente — puede incluso ser motivo de compensación (upgrade sin costo), según política comercial.
- El Availability Slot del Vehicle original se libera y el del nuevo se ocupa como parte del mismo movimiento — nunca queda un estado intermedio donde ambos aparecen ocupados o ambos libres.

## 8. Documentación del cliente vence durante el proceso

**Disparador:** el documento de identidad o licencia de un Customer vence entre el momento de la reserva y el Check-out (o incluso durante un alquiler largo).

**Actor que resuelve:** Agente de Reservas / Operador de Sucursal.

**Resolución de negocio:**
- Si vence antes del Check-out: no puede completarse la entrega hasta que el Cliente presente documentación vigente (RN-08).
- Si vence durante un alquiler en curso (`CheckedOut`): el negocio no puede "recuperar" el vehículo automáticamente — se gestiona como una excepción operativa: contacto con el Cliente, posible requerimiento de regularizar antes de cualquier Extension, pero no interrumpe un alquiler ya en curso solo por esta causa (salvo que la legislación local lo exija explícitamente).

## 9. Devolución con daño no declarado por el Cliente

**Disparador:** la inspección de Check-in detecta un daño que el Cliente no reportó proactivamente.

**Actor que resuelve:** Operador de Sucursal.

**Resolución de negocio:**
- Se registra un Damage Report comparando contra la línea base del Check-out (RN-14, RN-17).
- Si el Cliente disputa que el daño ocurrió durante su alquiler, el negocio depende de la calidad de la evidencia fotográfica de ambas inspecciones — por eso la inspección de Check-out no es opcional (RN-13): sin línea base, no hay forma legítima de resolver la disputa a favor de la empresa.
- Puede derivar en retención total o parcial del Security Deposit (RN-21) y en `ProgramarMantenimiento` si el daño afecta la operatividad.

## 10. Disputa de cobro / contracargo

**Disparador:** el Cliente reclama un cobro ante su banco/pasarela (chargeback) o directamente ante la empresa.

**Actor que resuelve:** Responsable Comercial/Financiero.

**Resolución de negocio:**
- Se recopila evidencia de negocio: contrato firmado, inspecciones de Check-out/Check-in, comunicación con el Cliente, comprobante de la Invoice.
- Mientras la disputa está abierta, el negocio no debe alterar retroactivamente el estado de la Reservation ya cerrada — la disputa es un proceso paralelo, no una reapertura del ciclo de alquiler.
- El resultado (a favor de la empresa o del Cliente) se resuelve por el proceso externo del proveedor de pago; el negocio solo registra el resultado final.

## 11. Vehículo devuelto en una sucursal distinta a la de origen

**Disparador:** el Cliente devuelve el vehículo en una Branch distinta a donde lo retiró (frecuente en alquileres de una vía / one-way).

**Actor que resuelve:** Operador de Sucursal (de la branch de devolución).

**Resolución de negocio:**
- Si la Company permite devoluciones en otra sucursal (política comercial, no siempre disponible), se registra el Check-in en la Branch receptora y el Vehicle pasa a pertenecer operativamente a esa Branch desde ese momento.
- Puede generar un Charge adicional por reposicionamiento de flota, según política de la Company.
- Si la Company **no** permite esta modalidad, se trata como incumplimiento de contrato por parte del Cliente y puede generar Penalty — este es un caso donde el negocio debe decidir explícitamente su propia política antes de operar en abierto, no asumir un comportamiento por defecto.

## 12. Cliente en lista de bloqueo / morosidad previa

**Disparador:** un Customer con historial de impago, daños no resueltos o incumplimientos graves intenta crear una nueva Reservation.

**Actor que resuelve:** Sistema (bloqueo automático según política), Agente de Reservas (para excepciones manuales).

**Resolución de negocio:**
- La Company puede definir un estado de bloqueo sobre un Customer que impide nuevas confirmaciones de Reservation hasta regularizar su situación.
- Un Administrador de Empresa (o rol equivalente con autoridad suficiente) puede levantar el bloqueo manualmente como excepción documentada — el sistema nunca debe impedir de forma absoluta que un humano con autoridad tome esa decisión, pero la decisión debe quedar auditada.

## 13. Sobreventa por error operativo (overbooking no causado por el sistema)

**Disparador:** un Operador confirma manualmente una reserva presencial sin verificar el sistema, y genera un solapamiento que el sistema no pudo prevenir (p. ej. proceso offline temporal).

**Actor que resuelve:** Administrador de Empresa / Agente de Reservas.

**Resolución de negocio:**
- Aunque el invariante RN-02 protege el flujo normal, un fallo operativo humano fuera del sistema puede producir el mismo efecto — el negocio necesita un proceso de resolución (no solo una regla de prevención): reubicar a uno de los dos clientes, ofrecer compensación, o conseguir un vehículo de reemplazo (alquiler a un tercero, en casos extremos).
- Esta excepción se documenta explícitamente para dejar claro que **la prevención técnica del solapamiento no elimina la necesidad de un proceso de negocio para cuando, aun así, ocurre por vía humana**.
