# 01 — REST Standards

Este documento es el estándar REST **completo** de la Plataforma. [08-API-CONTRACTS.md](../08-API-CONTRACTS.md) ya fijó las reglas raíz (envelope, versionado por recurso en el path, paginación por cursor, errores RFC 7807, idempotencia) — ninguna de esas decisiones se reabre aquí. Este documento las hereda como dato fijo y las profundiza al nivel de detalle que permite a Frontend, Backend, Mobile e integraciones de terceros implementar sin ambigüedad, sin necesitar releer el código para inferir una convención no escrita.

**Regla de lectura**: donde este documento parece repetir algo ya dicho en `docs/08-API-CONTRACTS.md`, es intencional — el mismo criterio de autocontención que ya usa [model/01-BOUNDED_CONTEXTS.md §"Regla de lectura"](../model/01-BOUNDED_CONTEXTS.md). Donde haya discrepancia aparente, `docs/08-API-CONTRACTS.md` es la fuente de verdad de la decisión raíz; este documento es la fuente de verdad de su desarrollo completo.

Este documento **no** es un contrato OpenAPI, no enumera endpoints concretos ni DTOs — eso es responsabilidad de la implementación, generada desde el código (`@nestjs/swagger`, ya fijado en [08-API-CONTRACTS.md §8](../08-API-CONTRACTS.md)). Fija las **reglas** que cualquier endpoint, presente o futuro, de cualquier Bounded Context, debe respetar.

## 1. Convenciones de recursos

- Un recurso público corresponde, casi siempre, a un Aggregate Root de [model/02-AGGREGATES.md](../model/02-AGGREGATES.md) — ver el mapeo completo en [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md). Una entidad interna (`Inspection`, `Charge`, `Rate`) **no** es un recurso de primer nivel salvo que el negocio necesite direccionarla, consultarla o mutarla independientemente de su agregado raíz — en ese caso es un sub-recurso (§1.2), nunca un recurso raíz propio.
- Nombre del recurso: sustantivo en plural, `kebab-case`, en inglés técnico (coherente con el resto del código, [09-CODING-STANDARDS.md](../technical/09-CODING-STANDARDS.md)) — `reservations`, `vehicle-categories`, `security-deposits`. Nunca un verbo (`/api/v1/createReservation` está prohibido).
- Un recurso interno (nunca expuesto a `web-admin`/`mobile`/terceros, solo a super-administración de Plataforma) sigue la misma convención de nombre bajo un prefijo propio — ver §9.

### 1.1 Identificadores en la URI

- Todo identificador de recurso en el path es el `EntityId<T>` del dominio ([model/04-VALUE_OBJECTS.md §1.3](../model/04-VALUE_OBJECTS.md)) — UUID v7, nunca un identificador secuencial expuesto ([04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)).
- Un identificador de negocio alterno (`InvoiceNumber`, `LicensePlate`) **nunca** reemplaza el `EntityId<T>` como clave de recurso en la URI — es, a lo sumo, un parámetro de filtro (`?invoiceNumber=...`) que resuelve a una colección, coherente con que el path identifica el recurso técnico, no su clave de negocio.

### 1.2 Sub-recursos: cuándo sí, cuándo no

Un sub-recurso anidado (`/api/v1/reservations/{id}/inspections`) se justifica únicamente cuando se cumplen **las tres** condiciones — si falta una, es un recurso raíz propio con un filtro, no un sub-recurso:

1. La entidad hija **no tiene sentido de negocio fuera de su agregado raíz** (una `Inspection` no se consulta nunca sin saber a qué `Reservation` pertenece).
2. La entidad hija es una **entidad interna** del mismo Aggregate Root en [model/03-ENTITIES.md](../model/03-ENTITIES.md) — nunca un agregado distinto, aunque esté relacionado (`/api/v1/reservations/{id}/invoice` está prohibido: `Invoice` es su propio Aggregate Root, se accede como `/api/v1/invoices?reservationId=...` o por su propio ID).
3. **Nunca más de dos niveles de anidamiento** (ya fijado en [08-API-CONTRACTS.md §1](../08-API-CONTRACTS.md)) — `/api/v1/reservations/{id}/inspections/{inspectionId}/photos` está prohibido; las fotos de una inspección se exponen como campo del recurso `inspection`, no como tercer nivel de URI.

| Ejemplo | Válido como sub-recurso | Por qué |
|---|---|---|
| `/api/v1/reservations/{id}/inspections` | Sí | `Inspection` es entidad interna de `Reservation` (§4.10 de [model/02-AGGREGATES.md](../model/02-AGGREGATES.md)), sin sentido fuera de ella |
| `/api/v1/vehicles/{id}/documents` | Sí | `VehicleDocument` es entidad interna de `Vehicle` |
| `/api/v1/reservations/{id}/invoice` | No | `Invoice` es un Aggregate Root propio de otro Bounded Context — se referencia por evento, nunca por FK ([03-RELACIONES.md §4](../persistence/03-RELACIONES.md) de persistencia); exponerlo como sub-recurso induciría al cliente a asumir un acoplamiento que el dominio ya evitó explícitamente |
| `/api/v1/customers/{id}/reservations` | No | `Reservation` es Aggregate Root propio — se expone como `/api/v1/reservations?customerId=...` (filtro sobre el recurso raíz, no anidamiento) |

### 1.3 Acciones de negocio que no son CRUD

Muchas transiciones de estado de [model/08-STATE_MACHINES.md](../model/08-STATE_MACHINES.md) no son un `PATCH` genérico sobre el recurso — son un comando de negocio con nombre propio, invariantes propias y, a menudo, un payload distinto del recurso completo (`confirm()`, `checkOut()`, `cancel()`, `swapVehicle()`). Se modelan como un sub-recurso de acción, verbo en infinitivo, colgando del recurso afectado:

```
POST /api/v1/reservations/{id}/confirm
POST /api/v1/reservations/{id}/check-out
POST /api/v1/reservations/{id}/swap-vehicle
POST /api/v1/vehicles/{id}/schedule-maintenance
```

- Siempre `POST` (nunca `PUT`/`PATCH`) — la acción no es idempotente por naturaleza HTTP, aunque puede exigir `Idempotency-Key` si su repetición accidental tiene efecto de negocio no trivialmente repetible (§7).
- El nombre del sub-recurso de acción coincide, en `kebab-case`, con el nombre del comando de dominio ya fijado en [05-CONVENCIONES-BACKEND.md §2](../05-CONVENCIONES-BACKEND.md) (`checkOut()` → `check-out`) — un desarrollador que conoce el catálogo de comandos de [model/08-STATE_MACHINES.md](../model/08-STATE_MACHINES.md) predice el nombre del endpoint sin consultar documentación adicional.
- Un endpoint de acción responde con el mismo formato de recurso que un `GET` a ese recurso (el agregado actualizado, o su proyección pública — ver [03-REQUEST-RESPONSE-STANDARDS.md](03-REQUEST-RESPONSE-STANDARDS.md)), nunca un objeto de forma distinta según la acción ejecutada.

## 2. Métodos HTTP

| Método | Uso | Idempotente (semántica HTTP) | Cuerpo de request |
|---|---|---|---|
| `GET` | Leer un recurso o una colección | Sí | Nunca |
| `POST` | Crear un recurso, o ejecutar una acción de negocio (§1.3) | No (salvo deduplicación explícita vía `Idempotency-Key`, §7) | Sí, salvo acciones sin parámetros |
| `PUT` | Nunca usado en v1.0 | — | — |
| `PATCH` | Actualización parcial de campos editables de un recurso que **no** representan una transición de máquina de estados (p. ej. datos de contacto de un `Customer`, dirección de una `Branch`) | Sí (aplicar el mismo `PATCH` dos veces produce el mismo estado) | Sí, solo los campos a modificar |
| `DELETE` | Eliminación de un recurso, solo donde el ciclo de vida del agregado lo admite (ver §2.1) | Sí | Nunca |

**Por qué no se usa `PUT`**: `PUT` implica reemplazo completo del recurso, lo cual es ajeno a un modelo donde cada agregado protege invariantes de transición (ningún agregado de [model/02-AGGREGATES.md](../model/02-AGGREGATES.md) se "reemplaza" como un documento — se muta a través de comandos explícitos). Introducir `PUT` invitaría a un cliente a reconstruir el recurso completo y reenviarlo, evadiendo la máquina de estados. Esta es una decisión nueva de este documento — ver [10-DECISIONES.md](10-DECISIONES.md) #1.

### 2.1 `DELETE` y su relación con soft delete

- `DELETE` sobre un recurso con soft delete a nivel de persistencia (`reservations`, `invoices` — únicas dos tablas, [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)) **no existe como operación de negocio ordinaria**: ninguno de los dos tiene un caso de uso de "eliminar" en su máquina de estados ([model/08-STATE_MACHINES.md §1, §4](../model/08-STATE_MACHINES.md)) — su terminación es `Cancelled`/`Closed` o `Voided`, alcanzada por una acción de negocio (§1.3), nunca por `DELETE`.
- `DELETE` se expone únicamente donde el ciclo de vida del agregado lo contempla como operación de negocio real: p. ej. revocar la asignación de un `Role` a un `User` (`DELETE /api/v1/users/{id}/roles/{roleId}`), eliminar un `File` (`DELETE /api/v1/files/{id}`, que internamente transiciona a `Deleted`, nunca borra físicamente — [model/02-AGGREGATES.md §15](../model/02-AGGREGATES.md)).
- Un `DELETE` sobre un recurso con soft delete responde `409` con `code: RESOURCE_DELETION_NOT_SUPPORTED` si se invoca — nunca `404` silencioso ni `501`, para que el error sea explícito sobre el catálogo de errores (§7 de [07-ERROR-CATALOG.md](07-ERROR-CATALOG.md)).

## 3. Versionado

Hereda [08-API-CONTRACTS.md §1](../08-API-CONTRACTS.md) sin modificación: versionado en el path, **por recurso**, `/api/v1/<recurso>`. Desarrollo completo de la política de versionado (cuándo subir de versión, cómo conviven v1/v2, deprecación) en [08-VERSIONING.md](08-VERSIONING.md) — este documento solo fija la mecánica de URI.

- Todo recurso nuevo nace en `v1`. No existe "v0"/beta sin versión en el path.
- Dos versiones de un mismo recurso pueden coexistir simultáneamente en producción (`/api/v1/reservations` y `/api/v1/reservations` con forma v2 en un path `/api/v2/reservations`) durante la ventana de migración — nunca dos formas de respuesta bajo el mismo path versionado.

## 4. Idempotencia

Hereda [08-API-CONTRACTS.md §7](../08-API-CONTRACTS.md): cabecera `Idempotency-Key` en toda creación/acción con efecto de negocio no trivialmente repetible.

- **Formato**: string opaco generado por el cliente (UUID recomendado), único por operación lógica que el cliente intenta realizar — no por reintento (un reintento de red reenvía la **misma** clave).
- **Alcance de deduplicación**: `(companyId, endpoint, idempotencyKey)` — la misma clave usada en dos endpoints distintos, o por dos `Company` distintas, no colisiona. Coherente con la decisión ya fijada para `payments.idempotency_key` en [persistence/05-INDICES-Y-CONSTRAINTS.md §3](../persistence/05-INDICES-Y-CONSTRAINTS.md) (anclada al tenant, no global).
- **Ventana de retención**: la clave se recuerda el tiempo suficiente para cubrir reintentos de red razonables (minutos, no días) — calibración exacta diferida a Fase 6, mismo criterio que el resto de calibraciones de `docs/technical/`.
- **Respuesta a una repetición detectada**: el mismo código y cuerpo que la primera ejecución exitosa (o el mismo error, si la primera ejecución falló de forma persistente) — nunca una respuesta distinta a la original, para que el cliente no necesite distinguir "primera vez" de "repetición deduplicada".
- **Endpoints obligados**: toda creación de `Reservation`, toda acción de `Payment` (`capture`, `refund`), toda acción de `SecurityDeposit`. Todo endpoint que dispare un cargo económico o un compromiso de inventario (`AvailabilitySlot`) obliga `Idempotency-Key`; su ausencia responde `400` con `code: IDEMPOTENCY_KEY_REQUIRED`.

## 5. Paginación

Hereda [08-API-CONTRACTS.md §5](../08-API-CONTRACTS.md): cursor por defecto, `limit` con tope 100 (default 25).

- **Cursor opaco**: nunca un número de página ni un offset legible — codifica internamente el punto de corte del último elemento devuelto (típicamente el `id` ordenable por tiempo, UUID v7, coherente con [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md)). Un cliente nunca construye ni interpreta un cursor manualmente.
- **Colecciones elegibles para offset** (excepción ya fijada): catálogos pequeños y estables — `vehicle-categories`, `roles` (`System`). Un endpoint declara explícitamente en su documentación OpenAPI cuál de los dos esquemas usa; nunca ambos simultáneamente sobre el mismo recurso.
- **Metadata de paginación** (cursor): `meta.nextCursor` (string u `null` si es la última página), `meta.limit`. Nunca `meta.total` en paginación por cursor (contar el total exacto de una colección de alto volumen bajo escritura concurrente es costoso y de valor dudoso — un cliente que necesita un conteo aproximado usa un endpoint de agregación de `reports`, no el `meta` de una lista transaccional).
- **Metadata de paginación** (offset): `meta.page`, `meta.pageSize`, `meta.totalItems`, `meta.totalPages` — solo disponible en los catálogos elegibles de esta excepción, donde contar es barato.

## 6. Ordenamiento

Hereda [08-API-CONTRACTS.md §6](../08-API-CONTRACTS.md): `?sort=-createdAt`, prefijo `-` para descendente, campos indexados explícitamente soportados por el endpoint.

- Un endpoint documenta su lista cerrada de campos ordenables — nunca "cualquier campo del recurso". Un campo no soportado en `sort` responde `400` con `code: UNSUPPORTED_SORT_FIELD`, nunca se ignora silenciosamente (ignorar un parámetro inválido sin avisar es una fuente clásica de bugs de cliente difíciles de diagnosticar).
- Ordenamiento múltiple (`?sort=-createdAt,vehicleId`) soportado donde el endpoint lo declara; el orden de los campos en la cadena es el orden de precedencia.
- El campo por defecto (sin `sort` explícito) es siempre determinístico — nunca "orden de inserción no garantizado" — típicamente `-createdAt` o el equivalente por `id` (UUID v7, ordenable por tiempo).

## 7. Filtros y búsqueda

Hereda [08-API-CONTRACTS.md §6](../08-API-CONTRACTS.md): query params planos y explícitos, nunca un lenguaje de query genérico.

- **Filtro de igualdad**: `?status=confirmed`, `?vehicleId=<uuid>` — un valor, comparación exacta.
- **Filtro de rango**: para campos de fecha, convención `<campo>From`/`<campo>To` (`?createdAtFrom=2026-01-01&createdAtTo=2026-02-01`), nunca un operador embebido en el nombre del parámetro.
- **Filtro de conjunto**: `?status=confirmed,checked-out` (valores separados por coma) donde el negocio lo requiere (p. ej. "reservas activas" = varios estados no terminales) — un endpoint documenta explícitamente si un filtro admite múltiples valores.
- **Búsqueda de texto libre**: un parámetro `q` reservado exclusivamente para búsqueda de texto no estructurado (p. ej. nombre de `Customer`, placa de `Vehicle`) — nunca reutilizado como filtro estructurado. Un endpoint que no ofrece búsqueda de texto simplemente no documenta `q`; usarlo contra un endpoint que no lo soporta responde `400` con `code: UNSUPPORTED_FILTER`.
- **`companyId`/`branchId` nunca son filtros de query aceptados desde el cliente** — ya fijado en [08-API-CONTRACTS.md §2](../08-API-CONTRACTS.md): se derivan del token, salvo el puñado de endpoints cross-tenant de super-administración de Plataforma (§9).
- Todo filtro combinado se interpreta en conjunción (`AND`) — nunca disyunción implícita entre parámetros distintos; una disyunción explícita, cuando el negocio la requiere, usa el filtro de conjunto (viñeta anterior), nunca un operador `OR` genérico.

## 8. Cache, ETag y Optimistic Concurrency — decisiones nuevas de este documento

Ningún documento previo fija el mecanismo HTTP de control de concurrencia ni de cacheo — [persistence/10-DECISIONES.md §5](../persistence/10-DECISIONES.md) ya fijó la columna `version` en todo Aggregate Root como mecanismo de concurrencia optimista **a nivel de base de datos**; este documento fija cómo ese mismo mecanismo se expone en el contrato HTTP. Ver justificación completa en [10-DECISIONES.md](10-DECISIONES.md) #2.

### 8.1 ETag como proyección HTTP de `version`

- Todo recurso individual (`GET /api/v1/reservations/{id}`) responde una cabecera `ETag` cuyo valor es una función determinística de `version` (p. ej. `W/"<version>"`, ETag débil — débil porque la serialización JSON puede variar sin que el estado de negocio cambie, p. ej. un campo `meta.generatedAt`).
- Una escritura sobre ese recurso (`PATCH`, o una acción de negocio de §1.3 que exige concurrencia protegida) puede enviar `If-Match: <etag>` — si el `version` actual del agregado no coincide, la operación se rechaza con `412 Precondition Failed` y `code: CONCURRENT_MODIFICATION`, **antes** de ejecutar cualquier lógica de dominio.
- `If-Match` es **obligatorio** en las acciones identificadas explícitamente en [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md) como de alta concurrencia de escritura (`Reservation.checkOut()`, `Reservation.checkIn()`, `Reservation.confirm()` — coherente con la nota de "`version` de alta prioridad por concurrencia de escritura" de [persistence/09-TRAZABILIDAD.md §4](../persistence/09-TRAZABILIDAD.md)); **opcional** en el resto, donde un cliente puede optar por protegerse de una sobreescritura perdida (*lost update*) o aceptar "última escritura gana".
- La ausencia de `If-Match` en una operación donde es opcional no es un error — el servidor ejecuta la operación contra el estado más reciente, tal como lo haría sin este mecanismo.

### 8.2 Cache-Control

- Recursos transaccionales (`reservations`, `payments`, `invoices`, cualquier recurso de [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md) marcado de alta volatilidad): `Cache-Control: private, no-store` — nunca cacheados por un intermediario ni por el navegador, dado que su contenido es sensible y cambia con alta frecuencia.
- Catálogos de baja volatilidad (`vehicle-categories`, roles `System`): `Cache-Control: private, max-age=<segundos>` con un valor conservador (minutos, no horas) — coherente con el `CacheInterceptor` opt-in ya fijado en [technical/03-BACKEND-ARCHITECTURE.md §8](../technical/03-BACKEND-ARCHITECTURE.md) para exactamente esos mismos endpoints.
- Nunca `public` — todo recurso de la Plataforma requiere autenticación (§9 de [08-API-CONTRACTS.md](../08-API-CONTRACTS.md)); un recurso cacheable por un proxy compartido sin distinguir tenant sería una fuga de aislamiento multi-tenant, contraria al principio rector de [09-SEGURIDAD.md §5](../09-SEGURIDAD.md).

## 9. Headers — catálogo completo

| Header | Dirección | Obligatorio | Propósito |
|---|---|---|---|
| `Authorization: Bearer <access_token>` | Request | Sí (salvo `@Public()`) | Autenticación — [09-SEGURIDAD.md §1](../09-SEGURIDAD.md) |
| `Idempotency-Key` | Request | Condicional (§4) | Deduplicación de efectos de negocio |
| `If-Match` | Request | Condicional (§8.1) | Concurrencia optimista |
| `X-Correlation-Id` | Request/Response | No (generado si ausente) | Trazabilidad de punta a punta — [technical/06-OBSERVABILITY.md §4](../technical/06-OBSERVABILITY.md); ecoado en la response y en `instance` del error RFC 7807 |
| `Accept-Language` | Request | No | Selecciona el idioma de `title`/`detail` humanos del error (§3 de [07-ERROR-CATALOG.md](07-ERROR-CATALOG.md)) — nunca afecta `code`, que es siempre estable e independiente de idioma |
| `ETag` | Response | Sí, en todo `GET` de recurso individual | §8.1 |
| `Cache-Control` | Response | Sí, en todo `GET` | §8.2 |
| `Link` | Response | No (recomendado en listas paginadas) | Enlaces `rel="next"` como alternativa navegable al `meta.nextCursor` — conveniencia, nunca la única fuente del cursor |

## 10. Endpoints cross-tenant de super-administración de Plataforma

Ya anticipados como excepción explícita en [08-API-CONTRACTS.md §2](../08-API-CONTRACTS.md) y en [persistence/06-RLS.md §5](../persistence/06-RLS.md) (rol `platform_admin`, `BYPASSRLS`). Este documento fija su convención de superficie:

- Prefijo de path propio, nunca mezclado con la API de tenant: `/api/v1/platform-admin/<recurso>` (p. ej. `/api/v1/platform-admin/companies/{id}/suspend`).
- Requiere un rol de super-administración de Plataforma, verificado por un Guard distinto al `PermissionGuard` de tenant ([technical/03-BACKEND-ARCHITECTURE.md §7](../technical/03-BACKEND-ARCHITECTURE.md)) — nunca el mismo mecanismo de autorización que un endpoint de `Company`.
- Cada operación cross-tenant se registra en `AuditLogEntry` con prioridad máxima — ya fijado en [09-SEGURIDAD.md §5](../09-SEGURIDAD.md) y [persistence/06-RLS.md §5](../persistence/06-RLS.md).
- El catálogo completo de qué operaciones son legítimamente cross-tenant es cerrado y documentado — no se agrega una nueva sin pasar primero por el mismo criterio de excepción ya fijado en esas dos fuentes.

## 11. Qué NO se decide en este documento

- El listado de recursos y sus operaciones disponibles → [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md).
- La forma exacta del envelope de request/response/error/warning → [03-REQUEST-RESPONSE-STANDARDS.md](03-REQUEST-RESPONSE-STANDARDS.md).
- El catálogo de códigos de error → [07-ERROR-CATALOG.md](07-ERROR-CATALOG.md).
- La política completa de versionado y deprecación → [08-VERSIONING.md](08-VERSIONING.md).
- Los valores calibrados de `limit` máximo por endpoint, ventana de idempotencia, y `max-age` de cache → Fase 6, mismo criterio que el resto de calibraciones de `docs/technical/`.
