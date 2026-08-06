# 09 — Futuras Capacidades

Este documento identifica capacidades de negocio que **hoy no se implementan**, pero que son previsibles a lo largo de la vida del producto. No se diseñan aquí — ni su modelo de dominio, ni su arquitectura, ni su alcance técnico. El objetivo es que quien planifique el roadmap futuro (más allá de [01-ROADMAP.md](../01-ROADMAP.md)) tenga un mapa de negocio de "qué podría venir" sin que eso condicione prematuramente el diseño actual.

Ninguna decisión de la Fase 0/1 debe anticipar estas capacidades con complejidad especulativa — son documentadas precisamente para poder **no** construirlas antes de tiempo (coherente con [00-VISION.md §3](../00-VISION.md): "la simplicidad es una decisión activa").

## 1. Inteligencia Artificial

- **Clasificación automática de daños en fotos de vehículos**: comparar fotos de Check-out y Check-in con visión por computadora para sugerir si hay un daño nuevo, como apoyo (no reemplazo) a la inspección del Operador de Sucursal.
- **Asistencia en redacción de reportes**: generación asistida de resúmenes para el Responsable Comercial/Financiero o el Administrador de Empresa a partir de datos operativos.
- **Predicción de demanda**: anticipar qué categorías de vehículo tendrán más solicitudes en una Branch para optimizar la composición de flota.
- **Chatbot de atención al cliente**: responder consultas frecuentes de disponibilidad/cotización antes de escalar a un Agente de Reservas humano.

Ya existe el criterio arquitectónico de cómo se integraría cada una (puertos específicos por capacidad, no un puerto genérico de IA — ver [11-INTEGRACIONES.md §9](../11-INTEGRACIONES.md)); aquí solo se documenta la necesidad de negocio que los justificaría.

## 2. Precios dinámicos (Yield Management)

Ajustar automáticamente la Rate de una categoría de vehículo según demanda, temporada, ocupación de flota o anticipación de la reserva — de forma análoga a como lo hacen hoteles y aerolíneas.

**Por qué no está en v1.0:** requiere volumen histórico de datos reales de la operación para calibrarse de forma responsable; introducirlo antes sería optimizar sobre datos que no existen. Ya excluido explícitamente en [03-DOMINIO.md §7](../03-DOMINIO.md).

## 3. Marketplace de flota entre empresas

Permitir que una Company ofrezca temporalmente vehículos excedentes a otra Company de la misma plataforma (o a un canal público), y viceversa, para cubrir picos de demanda sin poseer más flota de la necesaria.

**Implicación de negocio a futuro:** introduciría un nuevo actor ("Company proveedora" vs. "Company que revende"), y una relación comercial entre tenants que hoy la Plataforma no contempla — es un cambio de modelo de negocio, no solo una funcionalidad, por lo que amerita su propia fase de descubrimiento de dominio cuando se priorice.

## 4. GPS / IoT en vehículos

- **Rastreo en tiempo real**: ubicación del vehículo durante el alquiler, relevante para recuperación en caso de robo/impago severo y para logística de flota.
- **Telemetría de uso**: velocidad, frenadas bruscas, patrones de conducción — insumo potencial para mantenimiento predictivo (§5) y para diferenciar tarifas según perfil de conducción.
- **Inmovilización remota**: capacidad de bloquear el vehículo de forma remota ante incumplimiento grave (uso extremo, requiere marco legal/contractual explícito por país antes de siquiera evaluarse).

**Nota de negocio importante:** cualquier capacidad de rastreo/telemetría tiene implicaciones legales y de privacidad que varían fuertemente por país — no es una decisión puramente técnica, requiere marco legal y de consentimiento del Cliente antes de diseñarse.

## 5. Mantenimiento predictivo

Anticipar fallas mecánicas antes de que ocurran, usando telemetría del vehículo (§4) en lugar de solo umbrales fijos de kilometraje/tiempo (RN-29 en [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md)).

**Dependencia:** requiere que la capacidad de IoT/telemetría (§4) exista primero — es una extensión natural de Maintenance, no de Platform. Ya excluido explícitamente de v1.0 en [03-DOMINIO.md §7](../03-DOMINIO.md).

## 6. Firma digital de contratos

Ya existe el puerto arquitectónico (`DocumentSigningPort`, ver [11-INTEGRACIONES.md §10](../11-INTEGRACIONES.md)) pero su uso pleno en el flujo de Check-out (firma del contrato de alquiler en el momento de la entrega, sin papel) es una capacidad de negocio a madurar: hoy el proceso de Entrega ([03-PROCESOS.md §4](03-PROCESOS.md)) asume "firmar contrato/acta de entrega" de forma genérica, sin comprometerse a si es física o digital.

## 7. Aplicaciones dedicadas para conductores

Una app móvil específica para el Cliente (autogestión completa: reservar, hacer Check-in/Check-out asistido con fotos desde el propio teléfono, ver su historial) más allá del alcance de Fase 5 del roadmap actual (ver [01-ROADMAP.md §7](../01-ROADMAP.md)), que hoy solo compromete "operadores y/o clientes, a definir".

**Consideración de negocio:** un Check-out/Check-in "sin operador presente" (autoservicio total) cambia varias reglas críticas de [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md) — p. ej. quién es responsable de validar la inspección de estado si no hay un Operador humano presente. No es solo "la misma app en el teléfono del cliente"; es un modelo operativo distinto que requeriría su propio descubrimiento de reglas de negocio.

## 8. Portal de agencias / distribuidores

Permitir que terceros (agencias de viaje, distribuidores, partners comerciales) generen reservas en nombre de un Cliente final, con su propia comisión y condiciones — introduciendo un nuevo actor de negocio ("Agencia") no contemplado en [01-ACTORES.md](01-ACTORES.md).

**Implicación:** requeriría modelar comisión, atribución de la reserva a un canal, y posiblemente tarifas diferenciadas por canal — extensión natural de Rental Operations pero con reglas comerciales nuevas.

## 9. Multiidioma

Soporte de contenido (contratos, notificaciones, interfaz) en más de un idioma, relevante para operación en mercados con Clientes internacionales (turismo) o Companies que operan en más de un país con idiomas distintos.

**Nota:** esto es principalmente una capacidad de Platform (traducción de contenido, no de reglas de negocio) — se documenta aquí porque hoy no está resuelta, no porque vaya a pertenecer al dominio Rental.

## 10. Seguros y coberturas como línea de negocio propia

Hoy el seguro del vehículo se asume como una condición externa (RN-09, RN-27 en [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md)) gestionada fuera del sistema. Una capacidad futura sería ofrecer coberturas adicionales contratables por el Cliente al momento de reservar (p. ej. "reducción de responsabilidad por daño"), como upsell comercial.

**Implicación de negocio:** introduciría un nuevo tipo de Charge ligado a una póliza, y potencialmente un nuevo actor (Aseguradora como integración activa, no solo como referencia documental).

## 11. Programa de fidelización / clientes frecuentes

Beneficios acumulativos para Customers recurrentes (descuentos, prioridad de disponibilidad, upgrades de categoría) — hoy el dominio distingue Cliente natural de corporativo (ver [02-LENGUAJE-UBICUO.md §2](02-LENGUAJE-UBICUO.md)) pero no tiene noción de historial acumulado como activo comercial.

## 12. Alquiler de larga duración / suscripción

Un modelo comercial distinto del alquiler por días (RN-20): un Customer paga una cuota periódica por uso continuo de un vehículo durante meses, con condiciones de mantenimiento y reemplazo de unidad incluidas.

**Por qué se lista aquí y no en v1.0:** cambia supuestos base del dominio actual — el ciclo `Draft → Confirmed → CheckedOut → CheckedIn → Closed` de Reservation asume un evento de entrega y uno de devolución claramente delimitados; un modelo de suscripción con reemplazos periódicos de vehículo tensiona ese modelo y merece su propio descubrimiento antes de forzarlo sobre el actual.

## 13. Cómo tratar este documento hacia adelante

- Ninguna de estas capacidades debe influir en el modelado táctico de la Fase 2 (agregados, value objects) más allá de **evitar activamente** cerrar puertas que las bloquearían sin necesidad (p. ej., no hardcodear que una Reservation siempre tiene exactamente un Vehicle si en el futuro cercano se prevé razonablemente lo contrario — pero esa evaluación ya está resuelta y documentada como decisión consciente en [03-DOMINIO.md §3.1](../03-DOMINIO.md), no queda abierta aquí).
- Cuando el negocio decida priorizar una de estas capacidades, corresponde repetir el ejercicio de descubrimiento de dominio (actores, lenguaje ubicuo, procesos, reglas) específico para ella — no extender por analogía los documentos actuales sin revisarlos.
