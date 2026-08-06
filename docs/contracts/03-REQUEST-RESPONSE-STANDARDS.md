# 03 — Request/Response Standards

Desarrolla, al nivel de forma conceptual (no de DTO concreto), el envelope de request y response ya fijado en [08-API-CONTRACTS.md §2-3](../08-API-CONTRACTS.md). Cubre request, response, errores, **warnings** (concepto nuevo de este documento, §4), metadata, paginación y `correlationId`. Aplica a todo recurso de [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md), sin excepción por Bounded Context — es, junto con [01-REST-STANDARDS.md](01-REST-STANDARDS.md), lo que permite a un desarrollador predecir la forma de un endpoint que nunca leyó.

## 1. Request

### 1.1 Cuerpo

- Codificación `application/json` exclusiva — ningún endpoint de negocio acepta `multipart/form-data`/`x-www-form-urlencoded`; la carga de binarios (fotos, documentos) usa el flujo de dos pasos de `files` (URL firmada de subida directa a storage, nunca a través de `apps/api` — [02-RESOURCE-CATALOG.md §6](02-RESOURCE-CATALOG.md), [11-INTEGRACIONES.md §11](../11-INTEGRACIONES.md)).
- Campos en `camelCase` — coherente con el resto de TypeScript de la Plataforma ([technical/09-CODING-STANDARDS.md](../technical/09-CODING-STANDARDS.md)); la conversión a `snake_case` de persistencia ocurre en el repositorio, nunca es visible en el contrato HTTP.
- `companyId`/`branchId` **nunca** viajan en el cuerpo como fuente de verdad — ya fijado en [08-API-CONTRACTS.md §2](../08-API-CONTRACTS.md); un campo `companyId` presente en un body de request de tenant ordinario se ignora (nunca se usa como override), coherente con `05-CONVENCIONES-BACKEND.md §7`.
- Un campo no declarado en el contrato del endpoint es rechazado (`400`), nunca ignorado silenciosamente — mismo mecanismo que `ValidationPipe.forbidNonWhitelisted` ya fijado en [technical/03-BACKEND-ARCHITECTURE.md §5](../technical/03-BACKEND-ARCHITECTURE.md); esto es una regla de contrato, no solo de implementación: un cliente que envía un campo extra debe recibir una señal explícita de que ese campo no tiene efecto, no asumir silenciosamente que sí lo tuvo.

### 1.2 Distinción entre "campo ausente" y "campo `null`"

Regla nueva de este documento, necesaria para toda operación `PATCH` (§2 de [01-REST-STANDARDS.md](01-REST-STANDARDS.md)):

- **Campo ausente** en el cuerpo de un `PATCH`: no se modifica — el valor actual del recurso se preserva.
- **Campo presente con valor `null`**: se interpreta como "vaciar este campo", únicamente en los campos del dominio que el modelo permite nulos (p. ej. `Rate.validTo` en vigencia abierta, [model/03-ENTITIES.md §4.2](../model/03-ENTITIES.md)). Un `PATCH` con `null` sobre un campo obligatorio del dominio responde `422` con `code: FIELD_CANNOT_BE_NULL` — nunca se acepta silenciosamente ni se trata como "campo ausente".

Un endpoint que no distingue estos dos casos (framework que colapsa "ausente" y "`null`" en el mismo valor) debe implementarse de forma que preserve esta distinción a nivel de contrato — es una obligación del contrato, no una limitación aceptable de la herramienta.

## 2. Response — envelope de éxito

Hereda [08-API-CONTRACTS.md §3](../08-API-CONTRACTS.md): `{ data, meta }`. Este documento fija el contenido exacto de cada campo:

```
{
  "data": <recurso o colección>,
  "meta": {
    "generatedAt": "<timestamptz>",
    "apiVersion": "v1",
    ... campos específicos del endpoint (paginación, §5) ...
  },
  "warnings": [ ... ]   // ausente si no aplica, ver §4
}
```

- `data`: siempre presente en una respuesta `2xx`; nunca `null` salvo que el propio recurso represente ausencia por diseño de negocio (no hay ningún caso identificado en el catálogo de [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md) — toda ausencia se expresa con `404`, nunca con `data: null` y `200`).
- `meta.generatedAt`: instante de generación de la respuesta — permite a un cliente distinguir "dato que acabo de recibir" de "dato cacheado que estoy re-renderizando" sin depender únicamente de `Cache-Control` (§8.2 de [01-REST-STANDARDS.md](01-REST-STANDARDS.md)).
- `meta.apiVersion`: la versión de recurso servida (`v1`) — redundante con el path por diseño, útil para logging/debugging de cliente sin parsear la URL.
- Ningún campo de `meta` es interpretado por lógica de negocio del cliente más allá de paginación y navegación — `meta` es información *sobre* la respuesta, nunca datos de negocio que deberían estar en `data`.

### 2.1 Representación de un recurso individual

- Todo campo del recurso expuesto corresponde a una propiedad conceptual ya documentada en [model/02-AGGREGATES.md](../model/02-AGGREGATES.md)/[model/03-ENTITIES.md](../model/03-ENTITIES.md)/[model/04-VALUE_OBJECTS.md](../model/04-VALUE_OBJECTS.md) — nunca un campo interno de persistencia (`version` se expone únicamente como `ETag`, §8.1 de [01-REST-STANDARDS.md](01-REST-STANDARDS.md), nunca como campo `data.version` visible; `companyId` nunca viaja en `data` porque ya se deriva del token, mismo principio que en el request).
- Un `Money` se representa siempre como un objeto `{ amount: <entero, unidad mínima>, currency: <ISO-4217> }` — nunca un número decimal suelto, coherente con [model/04-VALUE_OBJECTS.md §1.1](../model/04-VALUE_OBJECTS.md) y [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md); esta es la única forma válida de serializar dinero en toda la API, sin excepción por endpoint.
- Un `DateRange` se representa como `{ start: <timestamptz ISO-8601>, end: <timestamptz ISO-8601> }` — nunca dos campos sueltos con nombres distintos por endpoint (`startDate`/`endDate` vs. `from`/`to`); un cliente que conoce la forma de `DateRange` en `reservations` predice la de `rates`.
- Una referencia a otro agregado (`vehicleId`, `customerId`) viaja siempre como el `EntityId<T>` (string UUID), nunca embebida por defecto — un cliente que necesita datos del agregado referenciado hace su propia consulta al recurso correspondiente (o usa `expand`, si el endpoint lo soporta explícitamente, §2.2) en vez de asumir un `include` implícito de servidor.

### 2.2 Expansión opcional de referencias (`expand`)

Decisión nueva de este documento — ver [10-DECISIONES.md](10-DECISIONES.md) #3. Un endpoint puede declarar explícitamente soporte de `?expand=vehicle,customer` para incluir, embebida bajo una clave del mismo nombre dentro de `data`, una proyección resumida (nunca el agregado completo) del recurso referenciado — evita el problema de sobre/infra-fetching que [ADR-0009](../ADR/0009-rest-sobre-graphql.md) ya identificó como el trade-off aceptado de REST sobre GraphQL, sin reabrir esa decisión.

- `expand` solo aplica a relaciones ya documentadas como válidas en [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md) — nunca una relación "por evento" (§4 de [persistence/03-RELACIONES.md](../persistence/03-RELACIONES.md), p. ej. `reservations` nunca expande `invoice`, que se referencia por consulta separada).
- La proyección expandida es siempre un subconjunto de solo lectura de campos públicos del recurso referenciado — nunca incluye sus propias relaciones anidadas (`expand` no es recursivo; `?expand=vehicle.category` no es válido).
- Un `expand` no soportado por el endpoint responde `400` con `code: UNSUPPORTED_EXPAND` — mismo principio de "nunca ignorar silenciosamente" que rige filtros y sort (§6-7 de [01-REST-STANDARDS.md](01-REST-STANDARDS.md)).

## 3. Response — envelope de error

Hereda [08-API-CONTRACTS.md §4](../08-API-CONTRACTS.md): RFC 7807 (`application/problem+json`) con `code` como campo estable adicional. Forma completa:

```
{
  "type": "https://docs.platform/errors/<code-en-kebab-case>",
  "title": "<resumen legible, en el idioma de Accept-Language>",
  "status": <código HTTP>,
  "detail": "<detalle legible, en el idioma de Accept-Language>",
  "instance": "<path del recurso afectado>",
  "code": "<CODE_ESTABLE_MAYUSCULAS>",
  "correlationId": "<mismo valor que X-Correlation-Id de la request>",
  "errors": [ ... ]   // ausente salvo error de validación con múltiples campos, ver §3.1
}
```

- `code` es la única propiedad que el cliente usa para lógica condicional — ya fijado; `title`/`detail` son exclusivamente para mostrar a un humano, nunca parseados.
- `correlationId` es una adición de este documento respecto al ejemplo de [08-API-CONTRACTS.md §4](../08-API-CONTRACTS.md) — permite que un usuario reporte un error citando un único identificador que el soporte técnico correlaciona directamente con logs/trazas/auditoría ([technical/06-OBSERVABILITY.md §4](../technical/06-OBSERVABILITY.md)).
- El catálogo completo de `code` posibles, agrupado por origen (dominio/técnico/infraestructura/integración) y su mapeo a `status`, vive en [07-ERROR-CATALOG.md](07-ERROR-CATALOG.md) — este documento fija la forma, no el contenido.

### 3.1 Errores de validación con múltiples campos

Un `400`/`422` originado por validación sintáctica de múltiples campos (nunca una única regla de negocio, que siempre tiene un único `code`) incluye `errors`, un arreglo de `{ field: <ruta del campo, dot-notation>, code: <CODE de campo>, message: <detalle> }` — permite a un formulario de `web-admin`/`mobile` resaltar cada campo inválido sin parsear `detail`. Ausente cuando el error no es de validación de campos (p. ej. un conflicto de negocio como `RESERVATION_OVERLAP`, que afecta la operación completa, no un campo individual).

## 4. Warnings — éxito con advertencia

**Concepto nuevo de este documento** — ningún documento previo lo definía. Justificación completa en [10-DECISIONES.md](10-DECISIONES.md) #4.

Una operación puede completarse exitosamente (`2xx`, con `data` presente) y a la vez señalar al cliente algo que no impidió la operación pero que el consumidor debería conocer — por ejemplo, un `check-out` registrado exitosamente donde la política de combustible detecta un nivel bajo no bloqueante, o una `Reservation` confirmada cuya `CompanySettings.NotificationChannelPreference` no pudo enviarse por el canal preferido y se degradó silenciosamente a un canal alternativo (RN-34).

```
{
  "data": { ... },
  "warnings": [
    { "code": "NOTIFICATION_CHANNEL_DEGRADED", "detail": "..." }
  ]
}
```

- `warnings` **nunca** cambia el código de estado HTTP de la respuesta ni el contenido de `data` — es información adicional, no una degradación del resultado.
- `warnings` es distinto de `errors` (§3.1): un `warning` ocurre en una respuesta exitosa; `errors` solo aparece dentro de una respuesta de error.
- Un endpoint que nunca produce advertencias simplemente omite el campo — no se serializa `"warnings": []` por convención (evita que un cliente interprete un arreglo vacío como una señal en sí misma).
- El catálogo de `code` de warning es un subconjunto del catálogo general de [07-ERROR-CATALOG.md](07-ERROR-CATALOG.md) — comparte el mismo espacio de nombres y la misma disciplina de estabilidad, para que un cliente no necesite dos catálogos distintos.

## 5. Metadata de paginación

Ya fijado en detalle en [01-REST-STANDARDS.md §5](01-REST-STANDARDS.md) — se resume aquí como parte del contrato de `meta`:

```
"meta": {
  "generatedAt": "...",
  "apiVersion": "v1",
  "nextCursor": "opaque-string-or-null",
  "limit": 25
}
```

Ningún otro campo de paginación es válido en el esquema por cursor (no `total`, no `page`) — ya justificado en [01-REST-STANDARDS.md §5](01-REST-STANDARDS.md).

## 6. Correlation ID — contrato de punta a punta

- Un cliente puede enviar `X-Correlation-Id` en la request; si lo hace, el valor se preserva de punta a punta (backend, eventos internos, `AuditLogEntry`). Si no lo envía, el backend genera uno y lo devuelve en la respuesta (`X-Correlation-Id` en la cabecera de response, y `correlationId` dentro de todo error, §3).
- Formato: UUID — sin estructura interna interpretada por el cliente, opaco por diseño (igual que un cursor de paginación).
- Es el mismo identificador usado en trazas distribuidas y logs estructurados ([technical/06-OBSERVABILITY.md §4](../technical/06-OBSERVABILITY.md)) — un cliente que reporta un `correlationId` de un error permite reconstruir la operación completa sin necesitar más contexto del usuario.
- `web-admin`/`mobile` generan su propio `X-Correlation-Id` por interacción de usuario relevante (p. ej. un flujo completo de creación de reserva) cuando quieren correlacionar múltiples llamadas HTTP bajo un mismo identificador de interacción — decisión de cliente, nunca impuesta por el servidor.

## 7. Qué NO se decide en este documento

- El catálogo completo de `code` de error/warning → [07-ERROR-CATALOG.md](07-ERROR-CATALOG.md).
- El listado de recursos y sus campos exactos → [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md) (catálogo) y la implementación (OpenAPI) para el detalle campo a campo.
- La política de versionado que determina cuándo un cambio de forma de `data`/`meta` exige `v2` → [08-VERSIONING.md](08-VERSIONING.md).
