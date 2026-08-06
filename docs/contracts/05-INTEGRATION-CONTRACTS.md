# 05 — Integration Contracts

Formaliza como **contrato oficial** las interfaces conceptuales (puertos) de cada integración externa ya identificada en [11-INTEGRACIONES.md](../11-INTEGRACIONES.md) y en el patrón raíz de [ADR-0010](../ADR/0010-provider-pattern-integraciones.md). Define **únicamente interfaces conceptuales** — operación, propósito, entradas/salidas conceptuales, precondición/poscondición, semántica de error y expectativa de tiempo de respuesta. **No define un SDK, un método TypeScript, ni un adaptador concreto** — la implementación exacta (firma de interfaz, nombre de clase) es responsabilidad de `platform/integration-providers` en la fase de construcción, respetando exactamente este contrato.

**Regla de lectura**: todo puerto de este documento hereda las cinco reglas comunes ya fijadas en [11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md) — puerto antes que adaptador, timeout + reintento con backoff obligatorio, verificación de firma en todo webhook entrante, credenciales solo en gestor de secretos, y "confirmar primero el estado de negocio, sincronizar externamente después". Ninguna fila de este documento repite esas cinco reglas; se listan una vez aquí para que el resto del documento no las repita.

## 1. `NotificationSenderPort` — WhatsApp, Email, SMS

| | |
|---|---|
| **Propósito** | Enviar un mensaje de negocio a un destinatario por un canal determinado, como reacción a un evento de dominio |
| **Consumido por** | `notifications` (Support), nunca directamente por `reservations`/`invoices`/`payments` — un módulo de negocio nunca conoce este puerto, solo publica el evento que `notifications` consume ([model/09-DEPENDENCIES.md §4](../model/09-DEPENDENCIES.md)) |
| **Operación conceptual: `send`** | Entrada: `channel` (`WhatsApp`\|`Email`\|`SMS`), `recipient` (VO `Recipient`), `template` (referencia a plantilla versionada — nunca texto libre construido en el momento, requisito explícito para WhatsApp fuera de ventana de 24h, [11-INTEGRACIONES.md §3](../11-INTEGRACIONES.md)), `templateParams` (datos para interpolar). Salida: identificador opaco de envío del proveedor, o error de envío |
| **Precondición** | La plantilla referenciada existe y está aprobada por el proveedor (WhatsApp) o registrada (Email/SMS) — verificado en configuración, no en cada llamada |
| **Poscondición de éxito** | El proveedor aceptó el mensaje para entrega — **no** garantiza entrega al destinatario final; la confirmación de entrega llega de forma asíncrona (§4 de [06-WEBHOOKS.md](06-WEBHOOKS.md)) y se traduce a `NotificationDelivered.v1` |
| **Semántica de error** | Un error de proveedor (canal caído, plantilla rechazada, destinatario inválido) nunca revierte el hecho de negocio que originó la notificación (RN-25, mismo principio de no revertir un hecho ya confirmado) — se traduce a `NotificationFailed.v1` y dispara la política de canal alternativo (RN-34, [model/02-AGGREGATES.md §16](../model/02-AGGREGATES.md)) |
| **Expectativa de tiempo de respuesta** | Llamada de encolado, no de entrega — debe responder en el orden de segundos (aceptar o rechazar el envío), nunca bloquear esperando confirmación de entrega real |

## 2. `PushNotificationSenderPort` — Push (mobile)

| | |
|---|---|
| **Propósito** | Enviar una notificación push a un dispositivo móvil registrado |
| **Consumido por** | `notifications`, mismo patrón que §1 |
| **Operación conceptual: `sendPush`** | Entrada: `deviceToken` (opaco, gestionado por `mobile` vía el servicio de push de Expo, [06-CONVENCIONES-FRONTEND.md](../06-CONVENCIONES-FRONTEND.md)), `title`, `body`, `data` (payload estructurado mínimo para deep-link dentro de la app). Salida: identificador opaco de envío, o error |
| **Precondición** | El dispositivo tiene un token de push válido registrado — la invalidación de un token vencido/desinstalado es responsabilidad del adaptador, no del dominio |
| **Poscondición de éxito** | El servicio de push (Expo) aceptó el envío — mismo matiz que §1: no es confirmación de entrega al dispositivo |
| **Semántica de error** | Un token inválido/expirado no es un error que deba propagarse como fallo de negocio — se registra y el token se marca para limpieza, sin bloquear el resto del flujo de notificación (que puede seguir por otro canal) |

## 3. `StorageProviderPort` — Files

| | |
|---|---|
| **Propósito** | Mediar el almacenamiento y acceso a binarios (fotos, documentos, PDFs) sin que ningún módulo de dominio conozca el proveedor concreto (MinIO en desarrollo, S3-compatible en producción — [11-INTEGRACIONES.md §11](../11-INTEGRACIONES.md)) |
| **Consumido por** | `files` (Support), único módulo autorizado a invocar este puerto — cualquier otro módulo que necesite almacenar un binario pasa por el recurso `files` (§6 de [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md)), nunca directamente por este puerto |
| **Operación conceptual: `getUploadUrl`** | Entrada: `contentType`, metadata mínima de contexto (quién sube, para qué agregado conceptual). Salida: una URL firmada de vida corta hacia la que el cliente HTTP (`web-admin`/`mobile`) sube el binario **directamente**, sin pasar por `apps/api` |
| **Operación conceptual: `confirmUpload`** | Entrada: la referencia devuelta por el paso anterior. Salida: confirma que el objeto existe en storage y crea el `File` (`FileUploaded.v1`) |
| **Operación conceptual: `getSignedUrl`** | Entrada: `fileId`. Salida: URL firmada de vida corta para lectura — nunca una URL pública permanente ([model/02-AGGREGATES.md §15](../model/02-AGGREGATES.md)) |
| **Operación conceptual: `delete`** | Entrada: `fileId`. Salida: marca lógica de eliminación (`FileDeleted.v1`) — la purga física del binario es un proceso de retención separado, fuera de este contrato |
| **Precondición** | Ninguna especial — es la integración más transversal de todas, consumida desde Fase 0 ([11-INTEGRACIONES.md §11](../11-INTEGRACIONES.md)) |
| **Poscondición de éxito** | El binario es recuperable vía `getSignedUrl` mientras el `File` no esté `Deleted` |
| **Semántica de error** | Un fallo de `confirmUpload` dispara una URL de subida huérfana en storage (nunca un `File` registrado) — la limpieza de objetos huérfanos es responsabilidad operativa del proveedor de storage (política de ciclo de vida), no una obligación de consistencia inmediata de la aplicación |

## 4. `DocumentExtractionPort` — OCR

| | |
|---|---|
| **Propósito** | Extraer datos estructurados de un documento fotografiado (identidad, licencia de conducir) como **sugerencia editable**, nunca como verdad de negocio automática ([11-INTEGRACIONES.md §8](../11-INTEGRACIONES.md), RN-12/INV-011) |
| **Consumido por** | `customers` (al registrar `IdentityDocument`), potencialmente `vehicles` (documentación vehicular) |
| **Operación conceptual: `extract`** | Entrada: `fileId` de la imagen ya subida (nunca el binario directamente — reutiliza `StorageProviderPort`). Salida: un conjunto de campos extraídos con nivel de confianza por campo, marcados estructuralmente como `extractedByOcr = true` |
| **Precondición** | El archivo referenciado es una imagen/PDF de un tipo de documento soportado por el proveedor |
| **Poscondición de éxito** | El resultado existe como dato editable, **nunca** persistido como `IdentityDocument.Verified` sin confirmación humana explícita — el caso de uso de aplicación exige ese paso intermedio sin excepción (INV-011) |
| **Semántica de error** | Un fallo de extracción (imagen ilegible, documento no reconocido) **nunca** bloquea el registro manual del cliente — degrada a captura 100% manual, nunca es un error que impida continuar el proceso de negocio |
| **Expectativa de tiempo de respuesta** | Segundos (interacción síncrona con el operador que está registrando el documento en el momento) |

## 5. `GeolocationPort` / `AddressLookupPort` — Google Maps

| | |
|---|---|
| **Propósito** | Geocodificar direcciones y calcular distancias, para logística de entrega/recogida y datos de `Branch`/`Customer` ([11-INTEGRACIONES.md §7](../11-INTEGRACIONES.md)) |
| **Consumido por** | `branches` (al registrar/editar dirección), potencialmente `reservations` (logística de entrega, futuro) |
| **Operación conceptual: `geocode`** | Entrada: dirección en texto libre estructurado (VO `Address`). Salida: coordenadas (`GeoCoordinates`) o ausencia si no se resuelve — nunca un error bloqueante: una dirección no geocodificable sigue siendo una `Address` válida sin coordenadas |
| **Operación conceptual: `distanceBetween`** | Entrada: dos `GeoCoordinates`. Salida: distancia/tiempo estimado |
| **Precondición** | Ninguna — es una capacidad de enriquecimiento, nunca de validación bloqueante de negocio |
| **Poscondición de éxito** | `Address` se enriquece con coordenadas, sin que esto la convierta en entidad ([model/04-VALUE_OBJECTS.md §3](../model/04-VALUE_OBJECTS.md)) |
| **Semántica de error** | Nunca bloquea el alta/edición del recurso que la usa — es una mejora best-effort |

## 6. `PaymentGatewayPort` — Stripe, Mercado Pago

| | |
|---|---|
| **Propósito** | Autorizar, capturar, reembolsar y consultar el estado de un cobro, con dos adaptadores desde v1.0 ([11-INTEGRACIONES.md §6](../11-INTEGRACIONES.md)) |
| **Consumido por** | `payments` (Commerce) exclusivamente — ningún otro módulo invoca este puerto directamente; `reservations`/`invoices` disparan el cobro a través del ciclo de eventos ya modelado ([model/09-DEPENDENCIES.md §2](../model/09-DEPENDENCIES.md)), nunca importando este puerto |
| **Operación conceptual: `authorize`** | Entrada: `Money`, `PaymentMethod`, `IdempotencyKey`. Salida: `GatewayReference` + estado (`Authorized`/`Failed`) — aplica solo a métodos con preautorización (tarjeta) |
| **Operación conceptual: `capture`** | Entrada: `GatewayReference` (o directo si el método no requiere preautorización, p. ej. efectivo/transferencia). Salida: estado (`Captured`/`Failed`) |
| **Operación conceptual: `refund`** | Entrada: `GatewayReference`, `Money` (parcial o total). Salida: estado (`Refunded`/`Failed`) |
| **Operación conceptual: `getStatus`** | Entrada: `GatewayReference`. Salida: estado vigente según el proveedor — usado para reconciliación, nunca como sustituto de la confirmación por webhook (§3 de [06-WEBHOOKS.md](06-WEBHOOKS.md)) |
| **Precondición** | `IdempotencyKey` no usada previamente para la misma operación lógica (INV-021) |
| **Poscondición de éxito** | El resultado se traduce siempre a un comando de dominio sobre `Payment` — nunca el payload crudo del proveedor muta el agregado directamente ([model/02-AGGREGATES.md §13](../model/02-AGGREGATES.md)) |
| **Semántica de error** | Un fallo después de que el `Vehicle` ya fue entregado nunca revierte `Reservation` (RN-25/INV-109) — se traduce siempre a `PaymentFailed.v1` y gestión de cobranza posterior |
| **Expectativa de tiempo de respuesta** | Síncrona para `authorize`/`capture` iniciados por el cliente (segundos, con timeout explícito — nunca espera indefinida, [11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md)); la confirmación definitiva de muchos métodos llega por webhook asíncrono (§3 de [06-WEBHOOKS.md](06-WEBHOOKS.md)), no por el valor de retorno de esta llamada |

## 7. `DocumentSigningPort` — Firma Digital

| | |
|---|---|
| **Propósito** | Recoger la aceptación formal de un documento legal (contrato de alquiler, y a futuro otros documentos de otros productos) ([11-INTEGRACIONES.md §10](../11-INTEGRACIONES.md)) |
| **Consumido por** | El módulo dueño del documento a firmar (`files`, o el módulo de producto que lo origina) |
| **Operación conceptual: `requestSignature`** | Entrada: `fileId` del documento, datos del/los firmante(s). Salida: referencia opaca de la solicitud de firma en el proveedor, estado inicial `Pending` |
| **Poscondición de éxito** | El estado de firma (`Pending`/`Signed`/`Declined`) se actualiza siempre vía evento cuando el proveedor confirma — nunca por consulta activa como única fuente de verdad |
| **Semántica de error** | Un rechazo de firma (`Declined`) es un resultado de negocio válido, nunca un error técnico — se traduce a un estado, no a una excepción |

## 8. Capacidades de IA — sin puerto único genérico

Ya fijado en [11-INTEGRACIONES.md §9](../11-INTEGRACIONES.md) y reafirmado aquí como contrato: **no existe** un `AIPort` genérico. Cada capacidad de IA se modela como un puerto específico de su caso de uso, con el mismo nivel de detalle de contrato que cualquier otro de este documento cuando se incorpore — por ejemplo, un futuro `DamageClassificationPort` (clasificación de daños en fotos de vehículo) seguiría el mismo patrón exacto de `DocumentExtractionPort` (§4): resultado siempre como sugerencia editable, nunca como verdad de negocio automática, coherente con la decisión ya fijada en [model/05-DOMAIN_SERVICES.md §4.3](../model/05-DOMAIN_SERVICES.md) (`DamageAssessmentService`, descartado como automatizable). Este documento no define un puerto de IA que no exista todavía en el descubrimiento de negocio aprobado — hacerlo sería anticipar una capacidad hipotética, contrario a [00-VISION.md §5](../00-VISION.md).

## 9. `CalendarPort` — nota de ubicación

`CalendarPort` (Scheduling, consumido por la ACL de Rental Operations) **no** es una integración externa — es un puerto síncrono **interno** de Plataforma, ya contratado completamente en [model/01-BOUNDED_CONTEXTS.md §4.2](../model/01-BOUNDED_CONTEXTS.md) y [model/09-DEPENDENCIES.md §2](../model/09-DEPENDENCIES.md). Se menciona aquí solo para dejar explícito por qué **no** tiene entrada en este documento: este catálogo es exclusivamente de integraciones con sistemas externos a la Plataforma (§1 de [11-INTEGRACIONES.md](../11-INTEGRACIONES.md)), nunca de comunicación entre Bounded Contexts propios.

## 10. Regla común de timeout y reintento — parámetros de contrato

Todo puerto de este documento declara, como parte de su contrato (no de su implementación), tres propiedades que un consumidor puede asumir sin conocer el adaptador concreto:

| Propiedad | Regla |
|---|---|
| **Timeout máximo** | Ninguna llamada es de espera indefinida ([11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md)); el valor exacto por integración se calibra en Fase 6 con datos reales — mismo criterio que el resto de calibraciones de `docs/technical/` — pero el **contrato** (que existe un timeout finito y configurado) es exigible desde v1.0. |
| **Política de reintento** | Backoff exponencial con número máximo de intentos, nunca reintento inmediato en bucle ni reintento infinito — coherente con [technical/03-BACKEND-ARCHITECTURE.md §11](../technical/03-BACKEND-ARCHITECTURE.md) (BullMQ) para las operaciones que se encolan como job. |
| **Circuit breaking** | Un proveedor que falla consistentemente no debe poder degradar la disponibilidad general de la Plataforma reteniendo workers/conexiones indefinidamente — mecanismo concreto (librería, umbrales) delegado a la implementación de `integration-providers`, pero el **contrato** (que existe algún mecanismo de aislamiento de fallos) es parte de este documento desde v1.0. |

## 11. Qué NO se decide en este documento

- El SDK o cliente HTTP concreto de cada proveedor, sus credenciales, y el mapeo exacto de campos proveedor↔plataforma → implementación de `platform/integration-providers`.
- Los valores calibrados de timeout/reintento/circuit breaking por proveedor → Fase 6.
- El contrato de recepción de eventos asíncronos de proveedor (webhooks entrantes) → [06-WEBHOOKS.md](06-WEBHOOKS.md).
- Qué proveedor concreto se usa por defecto para Email/SMS (ya declarado como decisión diferida en [11-INTEGRACIONES.md §4](../11-INTEGRACIONES.md)) → ADR de implementación correspondiente, cuando se seleccione.
