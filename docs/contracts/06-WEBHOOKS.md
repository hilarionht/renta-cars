# 06 — Webhooks

Diseña la estrategia completa de Webhooks de la Plataforma en sus dos direcciones: **entrantes** (un proveedor externo notifica a la Plataforma — ya anticipados como patrón en [11-INTEGRACIONES.md §3, §6, §12](../11-INTEGRACIONES.md)) y **salientes** (la Plataforma notifica a un sistema externo — ya anticipados como capacidad futura en [08-API-CONTRACTS.md §10](../08-API-CONTRACTS.md): "DTOs de eventos de dominio consumidos indirectamente por integraciones (webhooks salientes, si existieran)"). Este documento convierte ese "si existieran" en un contrato de diseño completo, listo para implementarse el día que un integrador externo real lo requiera, sin necesitar rediseño.

## 1. Webhooks entrantes — contrato de recepción

Todo proveedor externo con capacidad de notificación asíncrona (WhatsApp Business Cloud API, Stripe, Mercado Pago, proveedor de Firma Digital) entrega eventos a la Plataforma vía HTTP `POST` a un endpoint dedicado por proveedor, alojado en `infrastructure/http` de `integration-providers` ([11-INTEGRACIONES.md §2](../11-INTEGRACIONES.md)) — **nunca** en el path público versionado `/api/v1/...` de [01-REST-STANDARDS.md](01-REST-STANDARDS.md), porque un webhook entrante no es un recurso de la API de tenant: no lo invoca un cliente autenticado con `Bearer`, lo invoca el proveedor con su propio mecanismo de autenticidad (§2).

### 1.1 Convención de path

```
POST /webhooks/v1/<proveedor>
```

- Prefijo `/webhooks/` distinto de `/api/`, para que un desarrollador identifique de inmediato que un endpoint en ese namespace **no** sigue las reglas de autenticación por `Bearer` de [08-API-CONTRACTS.md §9](../08-API-CONTRACTS.md), sino las de §2 de este documento.
- Versionado en el path, igual que un recurso REST (§3 de [01-REST-STANDARDS.md](01-REST-STANDARDS.md)) — un cambio incompatible en cómo la Plataforma interpreta el payload de un proveedor exige una nueva versión de path, nunca una rama condicional dentro del mismo handler.
- `<proveedor>` es el identificador estable del proveedor concreto (`stripe`, `mercadopago`, `whatsapp`, un proveedor de firma digital) — nunca el nombre del puerto de dominio que consume el resultado (el path no dice `payment-gateway`, dice `stripe`), porque dos proveedores del mismo puerto (`Stripe` y `Mercado Pago` implementan ambos `PaymentGatewayPort`) tienen formatos de webhook completamente distintos entre sí.

### 1.2 Procesamiento — nunca directo sobre el dominio

Regla ya fijada, reafirmada aquí como contrato completo:

1. **Verificar la firma/autenticidad del proveedor primero** (§2), antes de deserializar el cuerpo como algo significativo — un payload no verificado se descarta con `401`, nunca se procesa "por si acaso es válido".
2. **Traducir a un evento interno versionado** ([model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md)) — el payload crudo del proveedor **nunca** llega a `domain/`/`application/` de ningún módulo consumidor; solo el evento ya traducido (`PaymentSucceeded.v1`, `WhatsAppMessageDelivered.v1` → `NotificationDelivered.v1`).
3. **Responder `200` al proveedor tan pronto la traducción y persistencia del evento interno se confirmaron** (vía el mismo mecanismo de Outbox de [technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md)) — nunca esperar a que todos los Listeners internos terminen de reaccionar antes de responder al proveedor, porque la mayoría de los proveedores reintentan agresivamente ante una respuesta lenta o ausente, y ese reintento no debe convertirse en una carrera contra el procesamiento interno completo.
4. **Idempotencia obligatoria en la traducción** (§4) — un webhook duplicado del proveedor (todos los proveedores relevantes de este catálogo garantizan *at-least-once*, nunca *exactly-once*) no debe traducirse dos veces a dos eventos internos distintos.

### 1.3 Timeout de respuesta al proveedor

Cada proveedor impone su propio límite de tiempo de respuesta antes de considerar el webhook fallido y reintentar (dato externo, no una decisión de este documento) — el endpoint de recepción debe responder dentro de ese margen sin excepción, lo cual refuerza el punto 3 de §1.2: la única forma de garantizar una respuesta rápida y consistente es no bloquear la respuesta HTTP en trabajo asíncrono de aplicación (Listeners/jobs de BullMQ, [technical/05-EVENTING.md §1](../technical/05-EVENTING.md)).

## 2. Seguridad y firma — webhooks entrantes

Ya exigido como regla transversal en [11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md): "toda integración con webhook entrante verifica firma/autenticidad antes de traducir a evento interno". Este documento fija el contrato exacto:

| Proveedor | Mecanismo de verificación | Consecuencia de falla |
|---|---|---|
| Stripe | Firma HMAC en cabecera (`Stripe-Signature`), verificada contra el secreto de webhook del proveedor (gestor de secretos, nunca hardcodeado — [07-SECURITY.md §3](../technical/07-SECURITY.md)) | `401`, evento descartado, incidente registrado en `audit_log` como intento de payload no verificado |
| Mercado Pago | Firma HMAC equivalente, mismo tratamiento | Igual |
| WhatsApp Business Cloud API | Firma HMAC de Meta sobre el cuerpo (`X-Hub-Signature-256`) | Igual |
| Proveedor de Firma Digital | Firma HMAC o verificación de certificado, según el mecanismo del proveedor seleccionado | Igual |

- El secreto de verificación de cada proveedor es un secreto de proveedor más, sujeto a la misma disciplina de gestión que cualquier credencial ([technical/07-SECURITY.md §3](../technical/07-SECURITY.md)) — nunca compartido entre entornos (el secreto de webhook de *staging* nunca es el mismo que el de producción).
- Un webhook cuya firma no verifica **nunca** se registra como intento de negocio válido — se registra únicamente como evento de seguridad (payload nunca persistido en claro más allá de lo necesario para el análisis del incidente, mismo principio de redacción de [technical/06-OBSERVABILITY.md §1](../technical/06-OBSERVABILITY.md)).
- **Rotación de secreto de webhook**: mismo mecanismo de ventana de gracia ya fijado para la clave de firma JWT en [technical/07-SECURITY.md §1](../technical/07-SECURITY.md) — el endpoint acepta ambos secretos (vigente y anterior) durante la ventana de rotación, para no perder eventos entrantes durante el cambio.

## 3. Reintentos — webhooks entrantes

- La política de reintento de un webhook **entrante** la define el proveedor, no la Plataforma — la única obligación de la Plataforma es responder de forma predecible: `200` si el evento se aceptó y tradujo (incluida una traducción idempotente de un duplicado, §4), cualquier código de error explícito (`401` firma inválida, `400` payload malformado, `500` solo ante un fallo genuinamente inesperado) en caso contrario, para que el proveedor reintente según su propia política.
- Un `500` de este endpoint **nunca** debe ser la respuesta a una regla de negocio rechazada (eso no existe conceptualmente aquí — un webhook entrante no "falla" por una regla de negocio, solo por no poder verificarse/traducirse) — reservado exclusivamente para fallos de infraestructura genuinos (base de datos no disponible al intentar persistir el evento traducido).

## 4. Idempotencia — webhooks entrantes

- Cada proveedor incluye, en su propio payload, un identificador de evento o de recurso que sirve de clave de deduplicación (`Stripe: event.id`, `Mercado Pago: id` de la notificación, `WhatsApp: message id`/`status id`). El adaptador de `integration-providers` correspondiente usa ese identificador como `IdempotencyKey` conceptual de la traducción — nunca genera uno propio que ignore el que el proveedor ya ofrece.
- La deduplicación ocurre **antes** de traducir a evento interno, no después — un webhook ya procesado responde `200` de inmediato sin volver a publicar el evento interno correspondiente, coherente con que el propio evento interno resultante (`PaymentSucceeded.v1`, etc.) lleva su propio `eventId` nuevo por cada traducción exitosa, por lo que evitar una segunda traducción es la única forma de evitar un `eventId` interno duplicado con el mismo significado de negocio.

## 5. Webhooks salientes — contrato de suscripción (capacidad de plataforma, no construida en v1.0)

Anticipado por [08-API-CONTRACTS.md §10](../08-API-CONTRACTS.md) como capacidad futura. Este documento fija su diseño completo para que, el día que un integrador externo real lo necesite, la implementación sea mecánica.

### 5.1 Modelo de suscripción

- Un consumidor externo (una integración de terceros autorizada) registra una **suscripción** — un `endpointUrl` propio, un secreto compartido (generado por la Plataforma, nunca elegido por el suscriptor) y el subconjunto de `eventType` de [model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md) al que quiere suscribirse. Este catálogo de suscripción es, en sí mismo, un recurso administrado por super-administración de Plataforma en v1.0 (no autogestionado por el tenant hasta que exista una necesidad de negocio real de exponerlo — mismo principio de [00-VISION.md §5](../00-VISION.md)).
- Solo eventos ya marcados como "cruza BC" en [model/06-DOMAIN_EVENTS.md §2](../model/06-DOMAIN_EVENTS.md) son elegibles para suscripción externa — un evento puramente interno de un Bounded Context nunca sale de la Plataforma vía Webhook.

### 5.2 Envelope de entrega

El mismo envelope de evento ya fijado en [04-EVENT-CONTRACTS.md §1](04-EVENT-CONTRACTS.md), sin traducción adicional — un consumidor externo recibe exactamente el mismo `eventType`/`payload`/`correlationId` que un Listener interno consumiría, para que la disciplina de versionado (§6) sea una sola, no dos contratos paralelos que mantener.

### 5.3 Seguridad y firma — webhooks salientes

Simétrico a §2, ahora con la Plataforma en el rol de proveedor:

- Cada entrega lleva una cabecera de firma HMAC (`X-Platform-Signature`) calculada sobre el cuerpo con el secreto propio de esa suscripción — un suscriptor verifica la firma con el mismo mecanismo que la Plataforma exige de sus propios proveedores (§2), consistencia deliberada de la disciplina de seguridad en ambas direcciones.
- El secreto de una suscripción es rotable por el propio suscriptor (vía la misma capacidad de administración de suscripciones, §5.1) — la Plataforma nunca transmite el secreto por un canal distinto al de su generación inicial (mostrado una única vez, igual que una API key convencional).

### 5.4 Reintentos — webhooks salientes

| Intento | Backoff |
|---|---|
| 1 | Inmediato |
| 2-5 | Exponencial, minutos |
| 6+ | Exponencial, hasta un techo, con tope de intentos totales calibrado en Fase 6 |

- Tras agotar los reintentos, la entrega se marca como fallida de forma terminal para ese `eventId`/suscriptor — **no** bloquea ni reintenta indefinidamente (mismo principio de `dead-letter` ya usado para colas de BullMQ, [technical/03-BACKEND-ARCHITECTURE.md §11](../technical/03-BACKEND-ARCHITECTURE.md)); queda visible para intervención administrativa (reenvío manual), nunca desaparece silenciosamente.
- Un suscriptor cuyo `endpointUrl` falla consistentemente (todas las entregas de una ventana de tiempo agotan reintentos) se marca automáticamente como suscripción degradada — visible en la administración de suscripciones, sin eliminarla automáticamente (una eliminación de suscripción es siempre una acción explícita del administrador, nunca automática).

### 5.5 Idempotencia — webhooks salientes

- Cada entrega lleva el `eventId` del evento original en el envelope (§5.2) — el suscriptor es responsable de deduplicar en su propio extremo, exactamente el mismo contrato que [04-EVENT-CONTRACTS.md §5](04-EVENT-CONTRACTS.md) exige a un consumidor interno. La Plataforma documenta este requisito al suscriptor (en la documentación de onboarding de la suscripción), pero no puede garantizar *exactly-once* de entrega — mismo límite fundamental que rige toda la disciplina de eventos de la Plataforma (`at-least-once`, [model/06-DOMAIN_EVENTS.md §10](../model/06-DOMAIN_EVENTS.md)).

### 5.6 Por qué esta capacidad no se construye en v1.0

No existe hoy un consumidor externo real que la necesite ([00-VISION.md §5](../00-VISION.md): "¿estamos resolviendo un problema real y presente, o uno hipotético?"). Este documento fija su contrato completo precisamente para que, cuando aparezca el primer integrador real, el diseño no se improvise bajo presión de un caso concreto — pero la construcción (tabla de suscripciones, worker de entrega, administración) es explícitamente diferida hasta esa necesidad, mismo criterio ya usado para `packages/sdk`/`packages/cli` en [technical/10-DECISIONES.md §9](../technical/10-DECISIONES.md).

## 6. Versionado de webhooks

Hereda la disciplina general de [08-VERSIONING.md](08-VERSIONING.md):

- **Entrantes**: un cambio incompatible en cómo la Plataforma interpreta el formato de un proveedor (p. ej. Stripe introduce un nuevo formato de evento) exige una nueva versión de path (`/webhooks/v2/stripe`) coexistiendo con la anterior hasta confirmar la migración — igual que cualquier recurso REST.
- **Salientes**: el envelope de entrega hacia un suscriptor sigue exactamente el versionado de eventos ya fijado en [04-EVENT-CONTRACTS.md §6](04-EVENT-CONTRACTS.md) — no existe un "versionado de webhook" distinto del versionado de evento, porque el webhook saliente no transforma el payload, solo lo entrega.

## 7. Qué NO se decide en este documento

- El proveedor concreto de cada integración entrante (ya fijado en [11-INTEGRACIONES.md](../11-INTEGRACIONES.md)) y su formato de payload específico — propiedad de la documentación de cada proveedor externo, fuera del control de la Plataforma.
- Los valores calibrados de timeout/número de reintentos/ventana de deduplicación → Fase 6.
- El mecanismo de almacenamiento físico de suscripciones salientes (tabla, schema) → se diseña en `docs/persistence/` el día que la capacidad de §5 se construya, siguiendo las mismas reglas de aislamiento multi-tenant y RLS ya fijadas en [persistence/06-RLS.md](../persistence/06-RLS.md).
