# 10 — Decisiones

Registro de las decisiones **nuevas** de esta fase de diseño de contratos — el equivalente, para `docs/contracts/`, de [docs/ADR/](../ADR/README.md), [technical/10-DECISIONES.md](../technical/10-DECISIONES.md) y [persistence/10-DECISIONES.md](../persistence/10-DECISIONES.md). Cada entrada es una decisión de **contrato de comunicación** derivada de una necesidad real de consistencia entre Frontend, Backend, Jobs, Eventos e Integraciones — nunca una reinterpretación de dominio, arquitectura o persistencia ya aprobados. Numeradas para poder referenciarse desde el resto de `docs/contracts/`.

## #1 — Sin `PUT` en la API pública

**Contexto**: [08-API-CONTRACTS.md](../08-API-CONTRACTS.md) fija `GET`/`POST` y menciona errores/paginación, pero no decide explícitamente si `PUT` tiene lugar en el estándar REST.

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| Soportar `PUT` para reemplazo completo de recurso, junto a `PATCH` para parcial | Descartada: invita a un cliente a reconstruir el recurso completo y reenviarlo, evadiendo la máquina de estados que cada agregado protege ([model/08-STATE_MACHINES.md](../model/08-STATE_MACHINES.md)) — ningún agregado de este modelo se "reemplaza" como documento |
| **Solo `PATCH` para edición de campos no transicionales; toda transición de estado es una acción de negocio explícita (`POST /recurso/{id}/<acción>`)** | Elegida |

**Decisión**: `PUT` no forma parte del estándar REST de la Plataforma. Ver [01-REST-STANDARDS.md §2](01-REST-STANDARDS.md).

**Consecuencias**: un cliente nunca puede mutar un agregado sin pasar por un comando de dominio con nombre propio — coherente con [05-CONVENCIONES-BACKEND.md §5](../05-CONVENCIONES-BACKEND.md) ("la regla de negocio vive en el agregado... nunca en el handler"), ahora reforzado también a nivel de superficie HTTP.

## #2 — ETag/`If-Match` como proyección HTTP de la columna `version`

**Contexto**: [persistence/10-DECISIONES.md §5](../persistence/10-DECISIONES.md) ya fijó `version` (concurrencia optimista) en todo Aggregate Root a nivel de base de datos. Ningún documento previo fijaba cómo ese mecanismo se expone — o no — en el contrato HTTP.

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| No exponer `version` en absoluto — dejar la resolución de conflictos de escritura concurrente completamente del lado del servidor, sin visibilidad para el cliente | Descartada: un cliente (`web-admin`) que pierde una actualización silenciosamente (dos operadores editando la misma `Reservation`) no tiene forma de detectarlo ni de informar al usuario — contradice el mismo argumento que justificó introducir `version` en primer lugar |
| Exponer `version` como campo de negocio en `data.version` | Descartada: mezclaría un detalle de control de concurrencia técnico con la representación de negocio del recurso — un cliente no debería necesitar entender qué es `version` para consumir el recurso normalmente |
| **`ETag`/`If-Match` (mecanismo HTTP estándar), opcional salvo en operaciones de alta concurrencia identificadas explícitamente** | Elegida |

**Decisión**: `version` se proyecta como `ETag` débil en toda respuesta `GET` de recurso individual; una escritura puede enviar `If-Match` para protegerse de una sobreescritura perdida, obligatorio en las operaciones de mayor riesgo de colisión (`confirm`, `checkOut`, `checkIn` de `Reservation`). Ver [01-REST-STANDARDS.md §8.1](01-REST-STANDARDS.md).

**Consecuencias**: reutiliza un mecanismo HTTP estándar en vez de inventar uno propio — cualquier cliente HTTP genérico (incluida una futura integración de terceros) lo reconoce sin documentación adicional de la Plataforma.

## #3 — `expand` como mecanismo opcional de proyección embebida

**Contexto**: [ADR-0009](../ADR/0009-rest-sobre-graphql.md) elige REST sobre GraphQL, aceptando explícitamente como trade-off que "un cliente que necesite datos de múltiples recursos relacionados debe hacer múltiples requests", con la salvedad de que "si aparece un patrón real de sobre/infra-fetching... se evalúan endpoints de agregación específicos". Ese ADR no diseñó el mecanismo — solo dejó la puerta abierta.

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| No introducir ningún mecanismo de expansión — mantener la disciplina estricta de un recurso por request | Descartada: `mobile` en redes lentas (el propio ADR-0009 lo señala como el caso más sensible) sufriría el costo de N round-trips para casos frecuentes (p. ej. listar `reservations` mostrando el nombre del `vehicle` y del `customer`) |
| Reabrir ADR-0009 e introducir GraphQL como capa de agregación | Descartada: ADR-0009 fija explícitamente que su revisión solo aplica ante "una necesidad real de agregación de datos heterogéneos que REST no pueda resolver razonablemente con endpoints compuestos" — un `expand` acotado resuelve exactamente el caso identificado sin llegar a ese umbral |
| **`?expand=<relación>` opcional, por endpoint, limitado a relaciones ya documentadas, nunca recursivo** | Elegida |

**Decisión**: ver [03-REQUEST-RESPONSE-STANDARDS.md §2.2](03-REQUEST-RESPONSE-STANDARDS.md).

**Consecuencias**: resuelve el caso de sobre-fetching más común sin introducir un lenguaje de query genérico (que [08-API-CONTRACTS.md §6](../08-API-CONTRACTS.md) ya descarta explícitamente) ni reabrir la decisión raíz de REST sobre GraphQL.

## #4 — `warnings` como tercer campo del envelope de respuesta

**Contexto**: el envelope `{ data, meta }` de [08-API-CONTRACTS.md §3](../08-API-CONTRACTS.md) no tiene lugar para comunicar una condición no bloqueante de una operación exitosa (p. ej. una notificación de confirmación que se degradó a un canal alternativo, RN-34).

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| Meter la advertencia dentro de `meta` como un campo ad-hoc por endpoint | Descartada: sin una forma estándar, cada módulo inventaría su propia convención — exactamente la inconsistencia entre recursos que [08-API-CONTRACTS.md §11](../08-API-CONTRACTS.md) prohíbe explícitamente |
| No comunicar la condición en absoluto — el cliente debe consultar el estado de `Notification` por separado si le interesa | Descartada: obliga a un round-trip adicional para una información que el propio servidor ya tenía disponible en el momento de responder |
| **Un tercer campo `warnings[]`, con la misma disciplina de `code` que los errores, presente solo cuando aplica** | Elegida |

**Decisión**: ver [03-REQUEST-RESPONSE-STANDARDS.md §4](03-REQUEST-RESPONSE-STANDARDS.md).

**Consecuencias**: un cliente puede, opcionalmente, mostrar la advertencia al usuario sin que la operación deje de considerarse exitosa — mantiene la semántica HTTP correcta (`2xx` sigue significando éxito) sin perder la señal.

## #5 — `correlationId` incorporado al envelope oficial de evento de dominio

**Contexto**: el envelope de evento ya fijado en [model/06-DOMAIN_EVENTS.md §1](../model/06-DOMAIN_EVENTS.md) (`eventId`, `eventType`, `occurredAt`, `companyId`, `payload`) no incluye un identificador de correlación con la request/job que originó el hecho. [technical/06-OBSERVABILITY.md §4](../technical/06-OBSERVABILITY.md) ya fija `correlationId` como transversal a logs/trazas/auditoría, pero no lo propaga explícitamente al envelope de evento.

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| No propagar `correlationId` al evento — reconstruir la correlación completa solo a través de `AuditLogEntry.Payload`, que ya lo incluye | Descartada: obligaría a cruzar `audit_log` para correlacionar un evento con su origen, cuando el propio evento podría llevarlo directamente sin costo adicional — la información ya existe en el contexto de ejecución del Command Handler que publica el evento |
| **Agregar `correlationId` (nulable) al envelope oficial de todo evento** | Elegida |

**Decisión**: ver [04-EVENT-CONTRACTS.md §1](04-EVENT-CONTRACTS.md). Es una extensión aditiva del envelope ya fijado — agregar un campo opcional nuevo a un contrato existente es, por la propia regla de compatibilidad de [08-VERSIONING.md §1](08-VERSIONING.md), un cambio compatible, no requiere subir la versión de ningún evento existente.

**Consecuencias**: permite reconstruir, desde un error reportado por un cliente vía `correlationId`, la cadena completa de eventos internos que esa request disparó, sin depender exclusivamente de `audit_log`.

## #6 — Compatibilidad de enumeraciones: máquinas de estado vs. catálogos abiertos

**Contexto**: ningún documento previo fijaba si agregar un valor nuevo a una enumeración cerrada del dominio es un cambio compatible o no — una ambigüedad real, dado que el modelo de dominio distingue explícitamente entre enumeraciones de máquina de estados ([model/08-STATE_MACHINES.md](../model/08-STATE_MACHINES.md), listas cerradas y finitas por invariante) y conjuntos configurables ([model/04-VALUE_OBJECTS.md §3](../model/04-VALUE_OBJECTS.md), abiertos por diseño).

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| Tratar toda enumeración por igual (todas compatibles, o todas incompatibles al agregar un valor) | Descartada: ignora una distinción real ya presente en el modelo de dominio — una máquina de estados es, por invariante, una lista cerrada que un consumidor puede razonablemente tratar de forma exhaustiva; un conjunto configurable (`PaymentMethodsEnabled`) es abierto por diseño desde el día uno |
| **Regla diferenciada: valor nuevo en máquina de estados = incompatible (exige nueva versión); valor nuevo en catálogo de error o conjunto configurable = compatible** | Elegida |

**Decisión**: ver [08-VERSIONING.md §5](08-VERSIONING.md).

**Consecuencias**: un desarrollador de frontend sabe, sin ambigüedad, cuándo puede escribir un `switch` exhaustivo con seguridad (nunca sobre `code` de error; sí, con cautela y sabiendo que puede requerir actualización coordinada, sobre `ReservationStatus`) y cuándo debe tratar el valor como un conjunto abierto.

## #7 — Prefijo `/webhooks/` separado de `/api/` para webhooks entrantes

**Contexto**: [11-INTEGRACIONES.md §3, §6](../11-INTEGRACIONES.md) ya establece que los webhooks entrantes se reciben en `infrastructure/http` de `integration-providers`, sin fijar su convención de path pública.

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| Modelar la recepción de webhook como un recurso más bajo `/api/v1/...` (p. ej. `/api/v1/payments/webhooks/stripe`) | Descartada: un webhook entrante no lleva `Authorization: Bearer` de un usuario de tenant — mezclarlo bajo el mismo prefijo que la API de tenant induciría a un desarrollador a asumir, incorrectamente, que sigue las mismas reglas de autenticación de [08-API-CONTRACTS.md §9](../08-API-CONTRACTS.md) |
| **Prefijo `/webhooks/v<N>/<proveedor>`, con su propio contrato de seguridad (firma HMAC, no Bearer)** | Elegida |

**Decisión**: ver [06-WEBHOOKS.md §1.1](06-WEBHOOKS.md).

**Consecuencias**: la separación de namespace hace visible, solo por la URL, que un endpoint tiene un contrato de autenticidad distinto — reduce el riesgo de que un desarrollador nuevo intente proteger un webhook con `JwtAuthGuard` (que rechazaría toda solicitud legítima del proveedor, que nunca envía un `access_token` de la Plataforma).

## #8 — Taxonomía de cuatro categorías para el catálogo de errores

**Contexto**: [08-API-CONTRACTS.md §4](../08-API-CONTRACTS.md) fija la forma RFC 7807 y el significado estricto de los códigos HTTP, pero no una taxonomía de `code` que ayude a un desarrollador a decidir, ante un error nuevo, a qué familia pertenece y qué `status` le corresponde.

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| Sin taxonomía explícita — cada `code` se decide caso a caso sin categoría | Descartada: ya se observa en la práctica de documentos previos (`RESERVATION_OVERLAP` vs. `TOKEN_EXPIRED` vs. `PAYMENT_GATEWAY_UNAVAILABLE`) que existen al menos tres naturalezas de error distintas con implicancias distintas para el cliente («corrige tu solicitud» vs. «corrige tu situación de negocio» vs. «reintenta más tarde») — no nombrar la distinción no la elimina, solo la deja implícita e inconsistente entre módulos |
| **Cuatro categorías nombradas (Dominio, Técnico, Infraestructura, Integración), cada una con su propia guía de `status` y de "quién puede corregirlo"** | Elegida |

**Decisión**: ver [07-ERROR-CATALOG.md §2](07-ERROR-CATALOG.md).

**Consecuencias**: un desarrollador que agrega un `code` nuevo tiene un criterio explícito para decidir su categoría y, por tanto, su `status` HTTP correcto, sin tener que inferirlo de ejemplos dispersos.

## #9 — `DELETE` sobre un recurso con soft-delete de persistencia responde `409`, no `404`/`501`

**Contexto**: [persistence/04-COLUMNAS-CONCEPTUALES.md](../persistence/04-COLUMNAS-CONCEPTUALES.md) fija soft-delete solo en `reservations`/`invoices`, ninguno con un caso de uso de "eliminación" en su máquina de estados — pero ningún documento fijaba qué debe responder la API si, aun así, un cliente intenta `DELETE` sobre esos recursos.

**Alternativas consideradas**:
| Alternativa | Evaluación |
|---|---|
| No exponer el método `DELETE` en absoluto sobre esos recursos (ausente de la documentación OpenAPI, `404`/`405` genérico del framework) | Descartada: un `404`/`405` sin `code` propio no le dice al desarrollador *por qué* — indistinguible de un error de enrutamiento accidental |
| **`409` explícito con `code: RESOURCE_DELETION_NOT_SUPPORTED`, documentado como comportamiento intencional** | Elegida |

**Decisión**: ver [01-REST-STANDARDS.md §2.1](01-REST-STANDARDS.md) y [07-ERROR-CATALOG.md §3](07-ERROR-CATALOG.md).

**Consecuencias**: el error es autoexplicativo y consistente con el resto del catálogo — un desarrollador de frontend que intenta ofrecer un botón "eliminar" sobre una `Reservation` recibe una señal clara de que esa operación no existe conceptualmente, en vez de un error ambiguo de framework.

## Qué NO se registra en este documento

- Decisiones ya tomadas en `docs/`, `docs/ADR/`, `docs/model/`, `docs/persistence/` o `docs/technical/` — se heredan, se citan, nunca se repiten aquí como si fueran nuevas.
- Valores de calibración dependientes de datos reales de producción (ventanas de deprecación en días, umbrales de rate limiting, timeouts de integración) — diferidos a Fase 6, mismo criterio ya usado en todo `docs/technical/` y `docs/persistence/`.
