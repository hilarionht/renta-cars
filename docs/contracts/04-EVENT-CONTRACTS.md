# 04 — Event Contracts

Formaliza, como **contrato oficial de comunicación**, el envelope y la disciplina de eventos de dominio ya modelados en [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md) (catálogo completo, payload por evento) y construidos técnicamente en [technical/05-EVENTING.md](../technical/05-EVENTING.md) (bus, Outbox, listeners). Este documento **no repite el catálogo** — la lista de eventos, su payload conceptual y sus consumidores actuales siguen viviendo exclusivamente en [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md), fuente de verdad única. Aquí se fija la **regla de contrato** que todo evento, presente o futuro, debe cumplir para que un consumidor — interno o, a futuro, externo — pueda depender de él sin sorpresas durante los 10 años de vida esperados de la Plataforma.

## 1. Envelope oficial (contrato, no repetición)

El envelope ya fijado en [model/06-DOMAIN_EVENTS.md §1](../model/06-DOMAIN_EVENTS.md) es el contrato — este documento añade el campo `correlationId`, coherente con [03-REQUEST-RESPONSE-STANDARDS.md §6](03-REQUEST-RESPONSE-STANDARDS.md) (ver [10-DECISIONES.md](10-DECISIONES.md) #5):

```
{
  eventId: UUID,             // identidad única del evento, usada para idempotencia de consumo (§5)
  eventType: string,         // "<Sujeto><ParticipioPasado>.v<N>"
  occurredAt: timestamptz,
  companyId: UUID | null,    // null solo en eventos verdaderamente globales de Plataforma
  correlationId: UUID | null,// heredado de la request/job que originó el hecho, si existe
  payload: { ... }           // específico de cada evento, ver model/06-DOMAIN_EVENTS.md
}
```

`correlationId` es opcional (`null`) únicamente cuando el hecho se origina en un proceso sin una request HTTP ni un job de usuario que lo dispare (p. ej. una transición automática por fecha, como `CustomerDocumentExpired.v1`, disparada por un job de vigencia sin actor humano en el momento). Cuando existe, es el mismo `correlationId` de la request/job que lo originó — permite trazar, desde un error reportado por un cliente, la cadena completa de eventos que esa request disparó, cruzando `AuditLogEntry.Payload` ([technical/06-OBSERVABILITY.md §4](../technical/06-OBSERVABILITY.md)).

## 2. Convención de nombre — contrato, no solo estilo

`eventType` sigue siempre `<Sujeto><ParticipioPasado>.v<N>` (`ReservationConfirmed.v1`), ya fijado en [05-CONVENCIONES-BACKEND.md §2](../05-CONVENCIONES-BACKEND.md). Como contrato, esto significa:

- El **sujeto** es siempre el Aggregate Root que lo publica ([model/02-AGGREGATES.md](../model/02-AGGREGATES.md)), nunca un sujeto compuesto ni un verbo de proceso (`ReservationCheckedOutAndVehicleUpdated.v1` está prohibido — son dos hechos, dos eventos).
- El **participio** describe el hecho ya consumado, nunca una intención (`ReservationConfirming.v1` no es válido — un evento de dominio documenta algo que **ya ocurrió**, coherente con que se publica solo tras persistir exitosamente, [model/06-DOMAIN_EVENTS.md §9](../model/06-DOMAIN_EVENTS.md)).
- La **versión** (`.v1`, `.v2`, ...) es obligatoria desde la primera publicación — INV-P05 ([model/07-INVARIANTS.md §3](../model/07-INVARIANTS.md)). No existe un evento sin sufijo de versión, ni un evento "borrador" sin versión que luego se numera.

## 3. Payload — reglas de contrato transversales

Estas reglas se aplican a **todo** evento del catálogo, además de lo que cada fila de [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md) ya especifica sobre su propio payload:

1. **Autocontenible por Published Language** — el payload lleva todo el dato que un consumidor externo al Bounded Context emisor necesita para actuar, nunca una referencia que obligue al consumidor a "ir a preguntarle" al productor por otro canal (`ReservationCheckedIn.v1` lleva el `PriceBreakdown` completo, no solo un `reservationId` que `Invoices` tendría que resolver consultando `rental.reservations` — ya justificado como decisión de dominio en [model/09-DEPENDENCIES.md §4](../model/09-DEPENDENCIES.md)).
2. **Nunca expone un tipo de dominio interno** — el payload es siempre un DTO plano versionado, nunca la entidad/agregado de dominio serializado directamente (evita que un cambio de refactor interno del dominio, sin cambio de contrato de negocio, rompa un consumidor).
3. **`Money` y `DateRange` en el payload siguen la misma forma que en la API REST** — `{ amount, currency }` y `{ start, end }` respectivamente (§2.1 de [03-REQUEST-RESPONSE-STANDARDS.md](03-REQUEST-RESPONSE-STANDARDS.md)) — un desarrollador que conoce la forma de un `Money` en la API predice la del payload de un evento, sin aprender una segunda convención de serialización.
4. **Nunca incluye un secreto ni dato sensible sin necesidad** — un payload de evento se persiste en `outbox_event` y en `audit_log` ([persistence/04-COLUMNAS-CONCEPTUALES.md §9](../persistence/04-COLUMNAS-CONCEPTUALES.md)), ambos con retención potencialmente larga; ningún payload lleva una contraseña, un token, o un número completo de documento/tarjeta — mismo principio de redacción ya fijado para logs en [technical/06-OBSERVABILITY.md §1](../technical/06-OBSERVABILITY.md).
5. **Validado en el momento de publicar, no solo de consumir** — ya fijado en [technical/05-EVENTING.md §4](../technical/05-EVENTING.md): un Command Handler que construye un payload inválido falla en su propio módulo.

## 4. Correlación entre eventos

Además de `correlationId` (§1, hereda la trazabilidad de la request que originó la cadena), un evento puede necesitar correlacionarse con **otro evento** que lo precede en un mismo flujo de negocio (p. ej. `InvoiceIssued.v1` es consecuencia directa de `ReservationCheckedIn.v1`). Esta correlación **no** se modela con un campo genérico adicional en el envelope — se resuelve de dos formas, según el caso, coherente con lo ya fijado en el modelo de dominio:

- **El payload transporta el identificador del hecho de negocio de origen** cuando es un dato de negocio real (`InvoiceIssued.v1.reservationId`) — no una correlación técnica, sino la relación de negocio ya modelada en [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md).
- **`correlationId` (§1) es la correlación técnica** cuando dos eventos comparten el mismo origen de request/job, independientemente de si hay una relación de negocio directa entre ellos.

No se introduce un tercer mecanismo (p. ej. un `causationId` separado de `correlationId`) porque ningún caso identificado en el catálogo aprobado lo requiere — introducirlo sin necesidad real sería la sobreingeniería que [00-VISION.md §3](../00-VISION.md) prohíbe explícitamente; se revisita si aparece un flujo real donde `correlationId` (de request) y "evento que causó este evento" diverjan de forma que un consumidor necesite distinguirlos.

## 5. Idempotencia — contrato del consumidor

Ya exigido en [model/06-DOMAIN_EVENTS.md §10](../model/06-DOMAIN_EVENTS.md) y [technical/05-EVENTING.md §3](../technical/05-EVENTING.md): todo consumidor debe tolerar entrega duplicada del mismo `eventId` sin efecto secundario doble. Como contrato explícito hacia cualquier equipo (interno o, a futuro, un integrador externo) que construya un nuevo Listener:

- El **contrato de entrega** del bus es *at-least-once*, nunca *exactly-once* (mecanismo del Outbox + relay, [technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md)) — un consumidor que asume entrega única viola el contrato, no es un caso límite a tolerar "cuando ocurra".
- Un consumidor **debe** poder responder correctamente a la pregunta "¿ya procesé este `eventId`?" antes de producir cualquier efecto no idempotente por sí mismo — mecanismo de referencia: `support.event_consumption_log` por `(consumerName, eventId)`, ya fijado en [technical/05-EVENTING.md §3](../technical/05-EVENTING.md); un consumidor cuyo propio efecto ya es naturalmente idempotente (un `upsert`) puede omitir esta verificación explícita, pero debe poder demostrar esa naturaleza idempotente, no asumirla.
- El **orden de entrega entre eventos de un mismo agregado no está garantizado entre distintos Bounded Context** — un consumidor que necesita procesar eventos en un orden estricto debe usar el propio `occurredAt` del payload para reordenar, nunca asumir que el orden de recepción coincide con el orden de ocurrencia.

## 6. Versionado y compatibilidad

Hereda sin modificación la disciplina ya fijada en [model/06-DOMAIN_EVENTS.md §11](../model/06-DOMAIN_EVENTS.md) y [technical/05-EVENTING.md §6](../technical/05-EVENTING.md) — desarrollo completo de la política transversal (REST + eventos + integraciones + webhooks) en [08-VERSIONING.md](08-VERSIONING.md). Resumen aplicado a eventos:

- Agregar un campo opcional al payload no rompe el contrato.
- Eliminar, renombrar o cambiar el tipo/semántica de un campo exige `eventType` nuevo (`.v2`), publicado en paralelo a `.v1` durante la ventana de migración.
- Un evento sin consumidores activos se marca deprecado en [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md) antes de eliminar su publicación — nunca se retira silenciosamente.

## 7. Superficie de consumo — quién puede depender de qué

- **Consumo interno** (un módulo de la Plataforma reacciona vía `Listener`, [technical/05-EVENTING.md §3](../technical/05-EVENTING.md)): cualquier evento del catálogo de [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md) es consumible por cualquier módulo, sin necesidad de un contrato adicional — el propio catálogo es el contrato.
- **Consumo externo** (una integración de terceros, a futuro): **no** existe consumo directo del bus in-process — un tercero nunca se suscribe al `EventEmitter2` ni lee `outbox_event` directamente. El único mecanismo de entrega de un evento de dominio hacia un sistema externo es un **Webhook saliente**, un producto derivado y explícitamente versionado por separado — ver [06-WEBHOOKS.md](06-WEBHOOKS.md). Esta distinción es deliberada: el catálogo de eventos internos puede evolucionar con más libertad relativa (todos los consumidores son código propio, desplegado junto con el productor) que el contrato de un Webhook saliente, que ata a un tercero fuera del control de despliegue de la Plataforma.

## 8. Qué NO se decide en este documento

- El catálogo completo de eventos, su payload exacto por tipo, publicador y consumidor actual → [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md) (sin cambios).
- El mecanismo técnico del bus, Outbox y relay → [technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md) y [technical/05-EVENTING.md](../technical/05-EVENTING.md) (sin cambios).
- El contrato de entrega hacia un consumidor externo (Webhook saliente) → [06-WEBHOOKS.md](06-WEBHOOKS.md).
- La política completa de versionado cruzando REST/eventos/integraciones → [08-VERSIONING.md](08-VERSIONING.md).
