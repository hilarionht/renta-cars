# 08 — API Contracts

Estándar único de API REST para toda la Plataforma. Todo módulo, de Plataforma o de Producto, expone sus endpoints siguiendo estas reglas — es lo que permite que frontend web, mobile y futuros consumidores (integraciones de terceros) traten cualquier recurso de cualquier producto de forma predecible.

## 1. Estilo y versionado

- **REST sobre HTTP/JSON**, no GraphQL. Justificación: el consumo es mayoritariamente CRUD + acciones de negocio bien definidas por recurso; REST da caching HTTP estándar, contratos más simples de versionar y documentar (OpenAPI/Swagger), y menor complejidad operativa que un gateway GraphQL — reevaluable si en el futuro aparece un caso real de agregación de datos altamente heterogénea desde clientes (no existe hoy).
- **Versionado en el path**: `/api/v1/...`. Un cambio incompatible de contrato exige una nueva versión de path (`/api/v2/...`) para el recurso afectado; no se versiona la API completa de golpe, se versiona por recurso cuando es necesario.
- **Convención de rutas**: `/api/v1/<recurso-en-plural>` (`/api/v1/reservations`), sub-recursos anidados solo cuando expresan pertenencia real (`/api/v1/reservations/{id}/charges`), nunca más de 2 niveles de anidamiento.

## 2. Estructura de Request

- `companyId`/`branchId` **nunca** viajan en el body ni en query params como fuente de verdad — se derivan del token de autenticación (ver [09-SEGURIDAD.md](09-SEGURIDAD.md)). Excepción explícita: endpoints de administración de plataforma operados por un rol super-admin cross-tenant, documentados caso por caso.
- DTOs de request versionados junto al endpoint (`CreateReservationRequestDtoV1`), validados con `class-validator` en el borde (ver [05-CONVENCIONES-BACKEND.md §9](05-CONVENCIONES-BACKEND.md)).

## 3. Estructura de Response

Toda respuesta exitosa sigue el mismo sobre (envelope):

```json
{
  "data": {},
  "meta": {}
}
```

- `data`: el recurso o colección solicitada.
- `meta`: metadatos opcionales (paginación, timestamps de generación). Ausente si no aplica.

## 4. Errores

Toda respuesta de error usa el mismo formato, alineado con el estándar `application/problem+json` (RFC 7807), para que un cliente HTTP genérico (o una futura integración de terceros) pueda parsear errores de cualquier módulo de la misma forma:

```json
{
  "type": "https://docs.platform/errors/reservation-overlap",
  "title": "Reservation overlaps with an existing booking",
  "status": 409,
  "detail": "Vehicle 4f2c... is already reserved between 2026-08-10 and 2026-08-14",
  "instance": "/api/v1/reservations",
  "code": "RESERVATION_OVERLAP"
}
```

- `code`: identificador estable, legible por máquina, único por tipo de error de negocio — es lo que el frontend usa para lógica condicional (nunca parsea `title`/`detail`, pensados para humanos).
- Mapeo de excepción de dominio → código HTTP + `code` es responsabilidad del `ExceptionFilter` global descrito en [05-CONVENCIONES-BACKEND.md §6](05-CONVENCIONES-BACKEND.md).
- Códigos HTTP usados con semántica estricta: `400` (validación sintáctica), `401` (no autenticado), `403` (autenticado, sin permiso), `404` (recurso no existe o no pertenece al tenant — mismo código, para no filtrar existencia entre tenants), `409` (conflicto de regla de negocio, p. ej. solapamiento), `422` (entidad válida sintácticamente pero inválida semánticamente), `500` (error no esperado, nunca expone detalle interno).

## 5. Paginación

Estándar único basado en cursor para listados de alto volumen (Reservations, Audit), con fallback offset-based solo para catálogos pequeños y estables (p. ej. `vehicle-categories`):

```
GET /api/v1/reservations?cursor=<opaque>&limit=25
```

```json
{
  "data": [],
  "meta": {
    "nextCursor": "opaque-string-or-null",
    "limit": 25
  }
}
```

`limit` máximo permitido por endpoint (configurable, default 25, tope 100) para evitar queries no acotadas.

**Gap conocido — `GET /audit-log`**: implementado (Fase 0 ítem 7) como lista plana con límite fijo (`LIST_LIMIT = 100`, `occurredAt DESC`), sin cursor — pese a que esta sección nombra Audit explícitamente como caso de alto volumen. Decisión documentada en [persistence/10-DECISIONES.md](persistence/10-DECISIONES.md): ningún endpoint del codebase implementó todavía el mecanismo de cursor y el volumen real en esta fase es mínimo; se prefirió dejar el gap explícito antes que construir un mecanismo de paginación sin un segundo caso de uso que lo justifique todavía. Pendiente para cuando el volumen real lo exija.

## 6. Filtros y ordenamiento

- Filtros como query params planos y explícitos por endpoint (`?status=confirmed&vehicleId=...`), documentados en OpenAPI por recurso — no se acepta un lenguaje de query genérico tipo `?filter[status][eq]=confirmed` salvo que un caso real de filtrado combinatorio complejo lo justifique (no existe en v1.0).
- Ordenamiento vía `?sort=-createdAt` (prefijo `-` para descendente), limitado a campos indexados explícitamente soportados por el endpoint.

## 7. Idempotencia

Toda operación de creación con efecto de negocio no trivialmente repetible (crear reserva, procesar pago) soporta cabecera `Idempotency-Key`, almacenada temporalmente por el módulo receptor para deduplicar reintentos de red — crítico en Payments/Reservations donde un doble submit no debe generar dos cargos o dos reservas.

## 8. Documentación

- **OpenAPI generado desde el código** (decoradores `@nestjs/swagger`), nunca mantenido a mano por separado — la fuente de verdad es el código del Controller/DTO, el documento se deriva.
- Publicado en `/api/docs` (Swagger UI) por entorno, protegido en producción.
- Todo endpoint documenta: parámetros, request/response DTOs, códigos de error posibles con su `code`, y ejemplo.

## 9. Autenticación en cada request

Ver detalle completo en [09-SEGURIDAD.md](09-SEGURIDAD.md). Resumen de contrato: `Authorization: Bearer <access_token>` en cada request protegido; `401` con `code: TOKEN_EXPIRED` es la única señal que el cliente usa para disparar el flujo de refresh — ningún otro código dispara refresh automático.

### 9.1 `X-Client-Platform` — entrega de `refresh_token` en `login`/`refresh`

Convención agregada durante la implementación de Identity & Access (Fase 0) — no existía una decisión previa en `docs/` sobre cómo distinguir un cliente web de uno móvil en `POST /auth/login` y `POST /auth/refresh`, y ambos necesitan tratamiento distinto para el `refresh_token` (un cliente web no debe tener el `refresh_token` accesible a JavaScript; un cliente móvil no tiene almacén de cookies del navegador).

- Header opcional `X-Client-Platform: web | mobile`. Ausente, o cualquier valor distinto de `mobile`, se trata como `web`.
- **`web`** (default): `refresh_token` se entrega **únicamente** en una cookie `Set-Cookie: refresh_token=...; HttpOnly; SameSite=Strict` (más `Secure` fuera de `development`) — nunca en el body de la response. `POST /auth/refresh`/`POST /auth/logout` leen el `refresh_token` de esa cookie si el body no lo trae explícito.
- **`mobile`**: `access_token` y `refresh_token` se entregan ambos en el body JSON de la response — no se setea cookie.

## 10. Compatibilidad hacia atrás

- Agregar un campo opcional a una response **no** es un cambio incompatible.
- Eliminar o renombrar un campo, cambiar su tipo, o cambiar la semántica de un código de estado existente **sí** lo es y exige nueva versión de path para ese recurso.
- Los DTOs de eventos de dominio consumidos indirectamente por integraciones (webhooks salientes, si existieran) siguen la misma disciplina de versionado que los eventos internos (§4 de [03-DOMINIO.md](03-DOMINIO.md)).

## 11. Consistencia entre módulos

Todo nuevo módulo (de Plataforma o de Producto) reutiliza: el mismo formato de envelope, el mismo formato de error, el mismo esquema de paginación, el mismo esquema de idempotencia. Un desarrollador que conoce la API de `reservations` debe poder predecir, sin leer documentación adicional, la forma de la API de un futuro módulo `work-orders` de Taller.
