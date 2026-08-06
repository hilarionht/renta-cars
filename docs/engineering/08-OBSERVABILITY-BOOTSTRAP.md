# 08 — Observability Bootstrap

[technical/06-OBSERVABILITY.md](../technical/06-OBSERVABILITY.md) fija la arquitectura completa (logging, tracing, métricas, correlation id, dashboards). Este documento fija únicamente el **bootstrap mínimo**: qué se levanta el primer día para que esa arquitectura sea observable desde `docker compose`, sin calibrar umbrales ni construir el catálogo completo de dashboards de producción (eso sigue diferido a Fase 6, [technical/06-OBSERVABILITY.md §6](../technical/06-OBSERVABILITY.md)).

## 1. Perfil `docker-compose.observability.yml`

Activado explícitamente (§5 de [06-DOCKER.md](06-DOCKER.md)), nunca por defecto:

| Servicio | Imagen | Rol |
|---|---|---|
| `otel-collector` | `otel/opentelemetry-collector-contrib` | Recibe OTLP de `apps/api` (logs, trazas, métricas), enruta a Tempo/Prometheus/Loki |
| `tempo` | `grafana/tempo` | Backend de trazas ([technical/10-DECISIONES.md #5](../technical/10-DECISIONES.md)) |
| `prometheus` | `prom/prometheus` | Backend de métricas, scrapea `/metrics` de `apps/api` o recibe vía el exportador OTLP del collector |
| `loki` | `grafana/loki` | Backend de logs |
| `grafana` | `grafana/grafana` | Visualización única, con datasources de Tempo/Prometheus/Loki pre-provisionados (stack "LGTM") |

`apps/api` en modo desarrollo apunta su exportador OTLP a `http://localhost:4318` (o al nombre de servicio `otel-collector` si `apps/api` también corre en contenedor) — variable `OTEL_EXPORTER_OTLP_ENDPOINT` del namespace `observability` ([07-CONFIGURATION.md §1](07-CONFIGURATION.md)); si el perfil de observabilidad no está activo, el SDK de OpenTelemetry simplemente falla en exportar sin bloquear la aplicación (exportador configurado como no bloqueante por diseño de la librería) — un desarrollador puede trabajar sin este perfil sin ver errores.

## 2. Provisioning de Grafana

- **Datasources**: definidos como archivos de provisioning versionados (`tooling/observability/grafana/datasources/`), no configurados a mano en la UI — Tempo, Prometheus y Loki quedan disponibles apenas Grafana arranca, sin paso manual.
- **Dashboards iniciales**, versionados como JSON de provisioning (`tooling/observability/grafana/dashboards/`), instancian el diseño ya fijado en [technical/06-OBSERVABILITY.md §6](../technical/06-OBSERVABILITY.md):
  1. Un dashboard "golden signals" (RED) genérico y parametrizable por Bounded Context — no uno distinto por módulo desde el día uno; se clona/ajusta a medida que cada módulo de la Fase 0/1 ([01-ROADMAP.md](../01-ROADMAP.md)) entra en operación.
  2. Un dashboard de infraestructura (USE de Postgres/Redis/BullMQ).
  3. Un dashboard de salud (`platform_health_ready`, §5 de [technical/06-OBSERVABILITY.md](../technical/06-OBSERVABILITY.md)).
  4. El dashboard de "ruido por tenant" (§6 de ese mismo documento) se agrega cuando exista más de un tenant de prueba con tráfico distinguible — construirlo antes sería visualizar una métrica sin datos que la hagan legible.

## 3. Qué se bootstrapea vs. qué se calibra después

| Bootstrapeado ahora (este documento) | Calibrado en Fase 6 ([technical/06-OBSERVABILITY.md §6](../technical/06-OBSERVABILITY.md)) |
|---|---|
| Instrumentación OTel activa (HTTP, Prisma, Redis, BullMQ) | Umbrales de alerta (p95 de latencia, tasa de error que dispara página) |
| Estructura de logs JSON + redacción de campos sensibles | Retención de logs/trazas a largo plazo y su costo asociado |
| Dashboards con paneles vacíos hasta que haya tráfico | Dashboards adicionales que solo tienen sentido con volumen real |
| Exportación local vía `docker-compose.observability.yml` | Backend de observabilidad gestionado en staging/producción (proveedor a elegir en implementación, mismo criterio que el resto de infraestructura de [technical/08-DEVOPS.md §4](../technical/08-DEVOPS.md)) |

Este documento no fija un solo número de umbral — sería la misma calibración especulativa que [00-VISION.md §3](../00-VISION.md) prohíbe, ya aplicada de forma idéntica en [technical/06-OBSERVABILITY.md §6](../technical/06-OBSERVABILITY.md) y [technical/07-SECURITY.md §5](../technical/07-SECURITY.md).

## 4. Health checks como primera señal

`/health/live` y `/health/ready` (ya fijados en [technical/03-BACKEND-ARCHITECTURE.md §10](../technical/03-BACKEND-ARCHITECTURE.md)) son la señal de observabilidad más básica y la primera que debe funcionar — antes incluso de que el perfil de observabilidad completo (§1) esté levantado, `curl localhost:<puerto>/health/ready` es el chequeo de humo estándar tras `docker compose up` + `npm run dev` (§1 de [02-DEVELOPER-EXPERIENCE.md](02-DEVELOPER-EXPERIENCE.md)) para confirmar que Postgres y Redis están accesibles.

## 5. Qué se decide en otro documento

- Arquitectura completa de logging, tracing, métricas y correlation id → [technical/06-OBSERVABILITY.md](../technical/06-OBSERVABILITY.md) (sin cambios).
- Servicios base de Docker Compose (Postgres, Redis, MinIO) → [06-DOCKER.md](06-DOCKER.md).
- Variables de entorno del namespace `observability` → [07-CONFIGURATION.md §1](07-CONFIGURATION.md).
