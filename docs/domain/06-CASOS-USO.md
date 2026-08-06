# 06 — Casos de Uso

Este documento enumera los casos de uso del negocio desde la perspectiva de cada actor (ver [01-ACTORES.md](01-ACTORES.md)). Un caso de uso aquí es una **capacidad de negocio que un actor necesita ejercer**, descrita en términos de objetivo y resultado esperado — no como flujo de pantallas ni como endpoint. Los flujos detallados de los casos más relevantes ya están en [03-PROCESOS.md](03-PROCESOS.md); aquí el foco es la cobertura completa, no la profundidad de cada uno.

Cada caso de uso indica su regla de negocio crítica asociada (ver [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md)) cuando aplica.

## 1. Casos de uso del Administrador de Empresa

| Caso de uso | Objetivo | Regla asociada |
|---|---|---|
| Configurar la empresa | Definir datos legales, fiscales y de contacto de la Company | — |
| Dar de alta una sucursal | Habilitar una nueva Branch para operar flota y atender clientes | — |
| Definir categorías de vehículo y tarifas | Establecer el catálogo comercial (Vehicle Category, Rate) | RN-20 |
| Definir política de cancelación | Establecer plazos y penalidades por cancelación | RN-26 |
| Definir política de garantía | Decidir si se exige Security Deposit, y su monto/mecanismo | RN-21 |
| Definir política de devolución tardía | Establecer tabla de Penalty por tardanza y tolerancia de gracia | RN-15, RN-16 |
| Dar de alta personal interno | Registrar Operadores, Agentes de Reservas, Responsables de Mantenimiento y asignarles alcance (Branch) | — |
| Consultar reportes consolidados | Ver ocupación de flota, ingresos, morosidad a nivel Company o por Branch | — |
| Auditar operación de una sucursal | Revisar el historial de reservas, cancelaciones y novedades de una Branch específica | — |

## 2. Casos de uso del Operador de Sucursal

| Caso de uso | Objetivo | Regla asociada |
|---|---|---|
| Consultar disponibilidad de flota | Ver qué vehículos están libres en un rango de fechas | RN-01, RN-04 |
| Registrar entrega de vehículo (Check-out) | Formalizar la entrega física, con inspección y Odometer | RN-13 |
| Registrar devolución de vehículo (Check-in) | Formalizar la devolución, con inspección comparativa | RN-14, RN-17 |
| Registrar daño de vehículo | Documentar un Damage Report detectado en cualquier momento del ciclo | RN-17 |
| Aplicar penalidad por devolución tardía | Calcular y registrar la Penalty correspondiente | RN-15 |
| Registrar No-show | Marcar que un cliente no se presentó a su Check-out | RN-19 |
| Realizar cambio de vehículo (Vehicle Swap) | Sustituir el Vehicle asignado a una Reservation en curso | RN-30 |
| Cancelar una reserva en sucursal | Ejecutar una cancelación solicitada presencialmente | RN-26 |
| Consultar historial de un cliente | Ver reservas previas de un Customer al momento de atenderlo | — |

## 3. Casos de uso del Agente de Reservas

| Caso de uso | Objetivo | Regla asociada |
|---|---|---|
| Cotizar un alquiler | Calcular precio estimado antes de comprometer al cliente | RN-20 |
| Crear una reserva en nombre del cliente | Registrar una Reservation por canal telefónico/WhatsApp/presencial | RN-01, RN-02 |
| Confirmar una reserva | Pasar una Reservation de `Draft` a `Confirmed`, validando disponibilidad y documentación | RN-01, RN-08 |
| Reprogramar una reserva | Modificar el Date Range de una reserva no iniciada | RN-01, RN-02 |
| Gestionar una cancelación solicitada por el cliente | Ejecutar la cancelación aplicando la política vigente | RN-26 |
| Registrar cliente corporativo con múltiples conductores | Dar de alta una cuenta empresarial y sus Conductores Adicionales | RN-09, RN-11 |
| Resolver una solicitud de extensión | Evaluar y aprobar/rechazar una Extension sobre una reserva en curso | RN-01, RN-02, RN-30 |

## 4. Casos de uso del Responsable de Mantenimiento

| Caso de uso | Objetivo | Regla asociada |
|---|---|---|
| Programar mantenimiento preventivo | Anticipar intervención según kilometraje/tiempo | RN-29, RN-30 |
| Registrar mantenimiento correctivo | Documentar una intervención motivada por avería/daño | RN-17 |
| Cambiar estado de un vehículo a mantenimiento | Bloquear disponibilidad de un Vehicle | RN-28 |
| Liberar un vehículo tras mantenimiento | Devolver un Vehicle a `Available` tras verificación de aptitud | RN-28 |
| Coordinar intervención con proveedor externo | Encargar un trabajo a un Proveedor de Servicios y hacer seguimiento | — |
| Consultar histórico de mantenimiento de un vehículo | Revisar intervenciones previas para decisiones de flota (p. ej. dar de baja una unidad) | — |

## 5. Casos de uso del Responsable Comercial/Financiero

| Caso de uso | Objetivo | Regla asociada |
|---|---|---|
| Emitir una factura | Generar el comprobante fiscal de una Reservation cerrada | RN-22, RN-23 |
| Conciliar pagos | Verificar que los Charges de una Reservation estén saldados | RN-25 |
| Gestionar una disputa de cobro | Atender un contracargo o reclamo sobre un Payment | — |
| Liberar o retener garantía | Decidir la devolución total/parcial de un Security Deposit | RN-21 |
| Consultar reporte de morosidad | Identificar Charges pendientes de cobro por Customer | — |
| Configurar métodos de pago aceptados | Definir qué pasarelas/métodos ofrece la Company | RN-24 |

## 6. Casos de uso del Cliente

| Caso de uso | Objetivo | Regla asociada |
|---|---|---|
| Registrarse como cliente | Crear su perfil (Customer) con documentación | RN-08 |
| Consultar disponibilidad y cotizar | Ver vehículos disponibles y su precio en un rango de fechas | RN-01, RN-20 |
| Reservar un vehículo | Crear y confirmar una Reservation | RN-01, RN-02, RN-08 |
| Cancelar su reserva | Solicitar cancelación antes de la entrega | RN-26 |
| Solicitar extensión de su alquiler | Pedir prolongar el período mientras el vehículo está en su poder | RN-01, RN-30 |
| Declarar un conductor adicional | Autorizar a otra persona a conducir el vehículo | RN-09 |
| Pagar su alquiler | Saldar los Charges asociados a su Reservation | — |
| Consultar su historial de alquileres | Ver reservas pasadas, facturas y pagos | — |
| Recibir notificaciones de su reserva | Ser informado de confirmación, recordatorios, comprobantes | RN-32, RN-33 |

## 7. Casos de uso del Conductor Adicional

| Caso de uso | Objetivo | Regla asociada |
|---|---|---|
| Ser validado como conductor autorizado | Presentar su licencia de conducir para ser habilitado en una Reservation | RN-09 |
| Recibir el vehículo en el Check-out | Ser reconocido como conductor autorizado al momento de la entrega, aun sin ser el Customer titular | RN-09 |

## 8. Casos de uso de actores de sistema

Estos casos de uso no los ejecuta una persona directamente, pero representan capacidades de negocio que el sistema ejerce en nombre del negocio, y por tanto deben documentarse igual que los anteriores.

| Caso de uso | Actor de sistema | Objetivo |
|---|---|---|
| Calcular disponibilidad de un vehículo | Motor de Disponibilidad | Responder si un Vehicle puede aceptar una Reservation en un Date Range |
| Enviar recordatorio proactivo | Motor de Notificaciones | Avisar al Cliente antes de un Check-out o vencimiento próximo |
| Reintentar notificación por canal alternativo | Motor de Notificaciones | Asegurar que un mensaje crítico llegue aunque falle el canal preferido |
| Registrar evento de auditoría | Motor de Auditoría | Dejar trazabilidad inmutable de una acción relevante de negocio |
| Consolidar reporte de ocupación | Motor de Reportes | Traducir datos transaccionales en indicadores de negocio |
| Autorizar/capturar un cobro | Pasarela de Pago | Procesar un Payment contra un Charge |
| Confirmar entrega de mensaje | WhatsApp / Email / SMS | Informar si una Notification llegó efectivamente a destino |

## 9. Casos de uso deliberadamente no cubiertos en esta fase

Coherente con [03-DOMINIO.md §7](../03-DOMINIO.md) y [05-REGLAS-NEGOCIO.md §8](05-REGLAS-NEGOCIO.md):

- Reservar un paquete de múltiples vehículos como una sola transacción comercial.
- Ajustar tarifas automáticamente según demanda en tiempo real.
- Programar mantenimiento de forma predictiva basada en telemetría del vehículo.

No se documentan como flujo porque el negocio no los necesita todavía — se retoman en [09-FUTURAS-CAPACIDADES.md](09-FUTURAS-CAPACIDADES.md).
