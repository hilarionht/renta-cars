# 06 — Observability

Fija la arquitectura de observabilidad sobre el stack ya definido: OpenTelemetry, Prometheus, Grafana, Loki. Ningún dato de negocio se redefine aquí — este documento cubre exclusivamente cómo el sistema se hace observable, coherente con [10-TESTING.md §8](../10-TESTING.md) (CI) y con el principio de auditoría ya fijado en [09-SEGURIDAD.md §4](../09-SEGURIDAD.md) (que es un registro de negocio, no de observabilidad técnica — ambos existen por razones distintas y no se sustituyen entre sí).

## 1. Logging

- **Formato**: JSON estructurado, un objeto por línea, nunca texto libre interpolado — requisito para que Loki pueda indexar por campo sin *parsing* frágil.
- Cada entrada de log lleva, como mínimo: `timestamp`, `level`, `message`, `correlationId` (§4), `companyId` (si la request está autenticada), `module`, y el `context` propio de NestJS (nombre de la clase que loguea).
- **Niveles**: `error` (excepción no esperada o fallo de integración externa tras agotar reintentos), `warn` (excepción de dominio traducida correctamente — es un resultado de negocio válido, no un bug, pero se registra para poder detectar patrones), `info` (eventos de negocio relevantes: creación/confirmación de reserva, pago procesado), `debug` (detalle de desarrollo, desactivado en producción).
- **Redacción obligatoria**: ningún log contiene contraseña, `access_token`/`refresh_token`, número completo de documento de identidad/tarjeta, ni el payload crudo de un webhook de proveedor antes de verificar su firma ([11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md)) — una lista de campos sensibles se mantiene centralizada y se aplica automáticamente en el serializador de logs, no caso a caso por cada `logger.log(...)`.
- El `LoggingInterceptor` global (§8 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) es la única fuente de logs de entrada/salida de request — un caso de uso individual loguea solo eventos de negocio propios, nunca duplica lo que el interceptor ya cubre.
- Envío a Loki vía el mismo colector de OpenTelemetry (§2) o un *shipper* dedicado (Promtail/Alloy) leyendo stdout del contenedor — cualquiera de las dos rutas es válida siempre que el pipeline preserve la estructura JSON y el `correlationId`.

## 2. Tracing

- **OpenTelemetry SDK** con auto-instrumentación para: HTTP entrante/saliente, Prisma, Redis, BullMQ — cobertura de los cuatro puntos donde una request puede pasar tiempo esperando I/O.
- **Propagación de contexto**: cabecera `traceparent` (estándar W3C Trace Context) aceptada en toda request entrante y propagada en toda llamada saliente (a integraciones externas, y — si aplica — entre `web-admin`/`mobile` y `api`, para correlacionar un trace de frontend con los spans de backend que originó).
- Un *span* por Command/Query Handler (nombrado `<módulo>.<caso-de-uso>`), con atributos `companyId` y `correlationId` — permite, en el backend de trazas, filtrar la actividad de un tenant específico sin acceder a logs.
- Exportación vía **OpenTelemetry Collector** a un backend compatible con el stack ya decidido (Grafana Tempo, por consistencia directa con Grafana/Loki/Prometheus ya elegidos — decisión de implementación documentada en [10-DECISIONES.md](10-DECISIONES.md) #5, no una nueva pieza arquitectónica independiente del stack dado).
- Los adaptadores de `integration-providers` ([11-INTEGRACIONES.md](../11-INTEGRACIONES.md)) instrumentan cada llamada externa como un *span* hijo con el nombre del proveedor — permite distinguir en una traza si la latencia de una operación viene del propio sistema o de un tercero (Stripe, WhatsApp, etc.).

## 3. Métricas

- **Prometheus** como backend, expuesto vía el exportador de métricas de OpenTelemetry (o `prom-client` directamente en `/metrics`, protegido/no público) — cualquiera de las dos rutas es aceptable, ambas producen el mismo formato de scraping.
- **Método RED** (Rate, Errors, Duration) por endpoint HTTP y por Command/Query Handler — la base mínima de todo dashboard operativo.
- **Método USE** (Utilization, Saturation, Errors) para recursos compartidos: pool de conexiones Postgres, Redis, colas de BullMQ (profundidad de cola, tasa de reintento, tamaño de dead-letter).
- **Métricas de negocio** como contadores/histogramas de primera clase, no un efecto secundario de parsear logs: reservas confirmadas, pagos exitosos/fallidos, notificaciones entregadas/fallidas por canal — expuestas por el propio Listener/Handler que produce el hecho, no reconstruidas después.
- Convención de nombre: `platform_<module>_<metric>_<unit>` (p. ej. `platform_reservations_confirmed_total`, `platform_payments_capture_duration_seconds`) — prefijo uniforme para que un dashboard de Grafana nuevo pueda descubrir métricas por convención, sin documentación adicional por módulo.
- Toda métrica que se particiona por tenant lo hace vía label `company_id` solo en agregaciones internas de bajo cardinal (nunca como label de alta cardinalidad sin agregación — evita explosión de series en Prometheus); el detalle de qué tenant específico generó un pico se investiga vía logs/trazas, no vía métricas etiquetadas por tenant individual.

## 4. Correlation ID

- Generado en el borde (`CorrelationIdInterceptor`, §8 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) si el cliente no envía uno propio (cabecera `X-Correlation-Id`); si lo envía, se conserva — permite que `web-admin`/`mobile` generen su propio id de sesión de interacción y lo propaguen de punta a punta.
- Propagado a través del contexto asíncrono de la request (no un parámetro pasado manualmente por cada capa) usando almacenamiento de contexto asíncrono compatible con NestJS (`AsyncLocalStorage`, vía `nestjs-cls` o equivalente) — disponible para el logger, el `LoggingInterceptor`, el `DomainExceptionFilter` (se incluye en la respuesta RFC 7807 como campo adicional junto a `instance`, [08-API-CONTRACTS.md §4](../08-API-CONTRACTS.md)) y el listener de `Audit`, sin que cada uno lo reciba explícitamente por parámetro.
- Incluido en `AuditLogEntry.Payload` — permite, ante una disputa o incidente, reconstruir la traza completa de una operación cruzando logs, trazas y el registro de auditoría de negocio con el mismo identificador.

## 5. Health checks

Ya fijados en [03-BACKEND-ARCHITECTURE.md §10](03-BACKEND-ARCHITECTURE.md) (`/health/live`, `/health/ready`). Este documento añade la integración de observabilidad: ambos endpoints emiten una métrica de estado (`platform_health_ready` 0/1) para que un dashboard/alerta pueda distinguir "el proceso está caído" de "el proceso está vivo pero degradado" sin depender únicamente del *scraping* HTTP externo.

## 6. Dashboards y alertas (diseño, no calibración)

- Un dashboard "golden signals" por Bounded Context (RED de sus endpoints/handlers principales), más un dashboard transversal de infraestructura (USE de Postgres/Redis/BullMQ).
- Un dashboard de "ruido por tenant": tasa de requests/errores agregada por `companyId` con umbral relativo (no absoluto) para detectar un tenant individual degradando el servicio de los demás (*noisy neighbor*) — relevante dado el modelo de aislamiento lógico (no físico) de [ADR-0004](../ADR/0004-multitenancy.md).
- Los umbrales concretos de alerta (latencia p95 aceptable, tasa de error que dispara página a guardia) **no se fijan en este documento** — se calibran en Fase 6 con tráfico real, mismo criterio ya usado para parámetros de seguridad en [09-SEGURIDAD.md §9](../09-SEGURIDAD.md) y para rate limiting en [07-SECURITY.md §5](07-SECURITY.md). Fijar un número sin datos reales sería una calibración especulativa, contraria a [00-VISION.md §3](../00-VISION.md).

## 7. Qué se decide en otro documento

- Auditoría de negocio (`AuditLogEntry`) como registro inmutable — no es observabilidad técnica, es un requisito de negocio/seguridad ya fijado en [09-SEGURIDAD.md §4](../09-SEGURIDAD.md) y modelado en [model/02-AGGREGATES.md §17](../model/02-AGGREGATES.md); este documento la referencia solo para compartir `correlationId`, nunca la sustituye.
- Rate limiting y su respaldo en Redis → [07-SECURITY.md §5](07-SECURITY.md).
- Pipeline de CI que valida que un PR no reduce cobertura → [10-TESTING.md §8](../10-TESTING.md) (sin cambios).
