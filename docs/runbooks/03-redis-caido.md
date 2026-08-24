# Runbook: Redis caído

**Alcance real de Redis hoy** (importante leer antes de actuar): Redis solo respalda `/health/ready` (`apps/api/src/app/redis/redis.provider.ts`). El cache de permisos de RBAC (`CachedRoleLookupAdapter`) y el storage de `ThrottlerGuard` siguen siendo **en memoria por proceso**, no Redis — gap ya documentado (`docs/persistence/10-DECISIONES.md #104`). Esto significa que, hoy, Redis caído degrada el health check pero **no** rompe permisos ni rate limiting — eso cambia el día que esas dos piezas migren a Redis (Fase 6, ítem "cache/performance" del roadmap), momento en el que este runbook necesita ampliarse.

**Sin telemetría de comandos Redis hoy**: el panel de Redis del dashboard "infra-use" está vacío, pero por un motivo distinto y ya documentado en el propio panel — `@opentelemetry/instrumentation-ioredis` no soporta la versión de `ioredis` instalada. No hay panel de Grafana que mostrar acá; no perder tiempo buscando uno.

## 1. Señal/Síntoma

- `/health/ready` falla o alerta `PlatformHealthCheckFailing` (`tooling/observability/alert-rules.yml`) dispara.
- Logs de `apps/api` con `[ioredis] Unhandled error event` o similar (conexión rechazada/timeout).
- Único signal confiable hoy: `platform_health_ready` + logs de aplicación — no telemetría de Redis en Grafana (ver nota arriba).

## 2. Diagnóstico inmediato

1. `docker compose ps redis` — confirmar si el contenedor está corriendo y en qué estado (`healthy`/`unhealthy`/detenido).
2. `docker compose logs redis --tail 50` — buscar la causa (OOM del contenedor, crash, problema de red).
3. Si Redis está arriba pero `apps/api` no puede conectarse: confirmar `REDIS_URL` en el entorno de la réplica afectada — un valor mal configurado en un despliegue reciente es más común que Redis mismo estando caído.

## 3. Mitigación

- Reiniciar el contenedor de Redis (`docker compose restart redis` en local; el mecanismo equivalente del orquestador en staging/producción) — Redis no persiste estado de negocio crítico hoy (solo respalda el health check), así que un reinicio limpio no pierde nada irrecuperable.
- Mientras Redis está caído, `/health/ready` reportará no-listo y el balanceador dejará de enrutar tráfico a esa réplica (`docs/technical/08-DEVOPS.md §6`) — este es el comportamiento correcto por diseño, no un bug a "arreglar" ocultando el chequeo.

## 4. Seguimiento de causa raíz

- Si Redis se cayó por OOM: revisar si el contenedor tiene un límite de memoria razonable configurado — no hay una política de eviction ni un límite documentado todavía en `docker-compose.yml`.
- Si fue un problema de red intermitente: el `ioredis` client ya reintenta con su política default — confirmar que esa política es la esperada (`redis.provider.ts` documenta el criterio actual, ajustado solo para el uso de hoy).
- **Recalibrar el impacto de este runbook** el día que RBAC o el rate limiter migren a Redis — a partir de ese momento Redis caído sí degrada autorización/throttling, no solo el health check, y este documento necesita una sección de mitigación nueva.

## 5. Docs relacionados

- `docs/persistence/10-DECISIONES.md #104` — por qué RBAC y el rate limiter siguen en memoria, no en Redis, hoy.
- `docs/technical/07-SECURITY.md §5` — diseño objetivo del `ThrottlerGuard` con storage compartido en Redis (todavía no implementado).
- `docs/technical/03-BACKEND-ARCHITECTURE.md §10` — `/health/live` vs `/health/ready`.
