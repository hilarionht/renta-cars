# Contratos de Comunicación

Esta carpeta fija los **contratos oficiales de comunicación** de la Plataforma: lo que Frontend, Backend, Jobs, Eventos, Integraciones, aplicaciones móviles y sistemas externos pueden asumir estable durante los 10 años de vida esperados del sistema. Construye, sin modificarlas, sobre las fases ya aprobadas: [Platform Architecture](../02-ARQUITECTURA.md), [Domain Discovery](../domain/README.md), [Domain Modeling](../model/README.md), [Platform Technical Design](../technical/README.md) y [Persistence Design](../persistence/README.md).

Este directorio **no contiene código, OpenAPI/YAML, NestJS, React, DTOs ni Controllers** — define reglas y catálogos conceptuales que la implementación debe respetar exactamente, en cualquier tecnología.

## Índice

| Doc | Contenido |
|---|---|
| [01-REST-STANDARDS.md](01-REST-STANDARDS.md) | Estándar REST completo: recursos, versionado, métodos HTTP, idempotencia, paginación, ordenamiento, filtros, cache, ETag, concurrencia optimista |
| [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md) | Catálogo de recursos públicos e internos por Aggregate Root, con sus operaciones y relaciones (sin endpoints concretos) |
| [03-REQUEST-RESPONSE-STANDARDS.md](03-REQUEST-RESPONSE-STANDARDS.md) | Forma de request, response, errores, warnings, metadata, paginación y correlation ID |
| [04-EVENT-CONTRACTS.md](04-EVENT-CONTRACTS.md) | Contrato conceptual de eventos de dominio: envelope, payload, correlación, idempotencia de consumo |
| [05-INTEGRATION-CONTRACTS.md](05-INTEGRATION-CONTRACTS.md) | Interfaces conceptuales de cada integración externa (WhatsApp, Email, Push, Storage, OCR, Maps, Payments, IA, Calendar, Firma Digital) |
| [06-WEBHOOKS.md](06-WEBHOOKS.md) | Estrategia de webhooks entrantes y salientes: versionado, seguridad, firma, reintentos, idempotencia |
| [07-ERROR-CATALOG.md](07-ERROR-CATALOG.md) | Catálogo oficial de errores de dominio, técnicos, de infraestructura e integración, con regla de nomenclatura |
| [08-VERSIONING.md](08-VERSIONING.md) | Estrategia única de versionado para REST, eventos, integraciones y webhooks; compatibilidad y deprecación |
| [09-TRAZABILIDAD.md](09-TRAZABILIDAD.md) | Matriz Aggregate → Recursos → Eventos → Integraciones → Consumidores |
| [10-DECISIONES.md](10-DECISIONES.md) | Decisiones nuevas de esta fase, con alternativas comparadas y justificación |

## Cómo leer esta carpeta

1. Empieza por [01-REST-STANDARDS.md](01-REST-STANDARDS.md) y [02-RESOURCE-CATALOG.md](02-RESOURCE-CATALOG.md) — fijan la superficie pública que todo lo demás referencia.
2. [09-TRAZABILIDAD.md](09-TRAZABILIDAD.md) es el mapa de verificación: confirma que ningún agregado del modelo de dominio quedó sin contrato.
3. [10-DECISIONES.md](10-DECISIONES.md) explica el **por qué** de cada regla nueva introducida en esta fase — consúltalo antes de proponer cambiar una de estas reglas.

## Regla de consistencia

Ningún documento de esta carpeta redefine una decisión ya aprobada en `docs/`, `docs/domain/`, `docs/model/`, `docs/persistence/` o `docs/technical/` — las hereda y construye sobre ellas. Un cambio a un contrato ya publicado sigue la disciplina de [08-VERSIONING.md](08-VERSIONING.md), nunca una edición silenciosa.
