# Runbook: Redis caído

**Alcance real de Redis hoy** (actualizado tras `docs/persistence/10-DECISIONES.md #119` — el gap de disponibilidad total ya está cerrado, ver más abajo): hay **3 clientes separados**, cada uno con tuning deliberadamente distinto:

- `HEALTH_REDIS_CLIENT` (`apps/api/src/app/redis/redis.provider.ts`) — respalda `/health/ready` exclusivamente. Fail-fast (`maxRetriesPerRequest: 1`, `connectTimeout: 2000`, `enableOfflineQueue: false`) — si Redis está caído, este cliente lo reporta rápido, sin colgar el health check.
- `CACHE_REDIS_CLIENT` (`libs/platform/persistence-kernel/src/redis-client.provider.ts`, `RedisCacheModule`) — respalda **únicamente** el cache de permisos RBAC (`CachedRoleLookupAdapter`) desde `#119`. Política de reintento **default** de `ioredis` (más paciente, apropiada para no fallar una request de negocio solo porque Redis tardó un poco en responder).
- `THROTTLER_REDIS_CLIENT` (`apps/api/src/app/redis/throttler-redis.provider.ts`, nuevo en `#119`) — respalda **únicamente** el storage de `ThrottlerGuard` (`ThrottlerStorageRedisService`, `@nest-lab/throttler-storage-redis`). Mismo tuning fail-fast que `HEALTH_REDIS_CLIENT` (`maxRetriesPerRequest: 1`, `connectTimeout: 2000`, `enableOfflineQueue: false`) — deliberado: combinado con `FailOpenThrottlerGuard` (ver abajo), un fallo de Redis se detecta casi al instante en vez de colgar el guard.

**Impacto real hoy si Redis cae** (`#119` cerró el incidente de disponibilidad total que `#114` había verificado y dejado sin resolver):

1. `/health/ready` reporta no-listo → el balanceador deja de enrutar tráfico a esa réplica (comportamiento correcto por diseño, `docs/technical/08-DEVOPS.md §6`).
2. **Permisos RBAC**: cada `get`/`set`/`del` contra `CACHE_REDIS_CLIENT` está envuelto en `try/catch` (`cached-role-lookup.adapter.ts`) — un error de Redis se trata como cache-miss, nunca como fallo de la request. `PermissionGuard` sigue funcionando, pero cae a resolver `roles[] → permissions[]` contra Postgres en **cada** request (más lento, nunca bloquea).
3. **Rate limiting — ya no es un incidente de disponibilidad, es una degradación controlada** (`#119`): `FailOpenThrottlerGuard` (`apps/api/src/app/throttler/fail-open-throttler.guard.ts`) sobreescribe `handleRequest()` de `ThrottlerGuard` con un `try/catch` — un fallo de `THROTTLER_REDIS_CLIENT` (fail-fast, ver arriba) hace **fail-open**: la request pasa sin rate limiting, con un `WARN` logueado (`"Redis no disponible para el throttler, fail-open..."`). `ThrottlerException` (límite realmente superado, un `429` legítimo) sigue propagando sin cambios — solo un fallo de infraestructura dispara el fail-open. **Verificado en vivo** (`docker compose stop redis` con `apps/api` corriendo): la request resolvió en **~8ms** (antes: colgada indefinidamente, más de 90s sin respuesta) con `200`, sin rate limiting activo mientras Redis estuvo caído. Recuperación automática y rápida una vez Redis vuelve a estar arriba, sin reiniciar `apps/api` — el throttling normal (incluyendo `429` al superar el límite) resumió correctamente en la misma prueba.
4. **Trade-off de seguridad aceptado explícitamente** (`#119`): durante una caída de Redis, hay una ventana sin protección de rate limiting en TODAS las rutas (incluidas `login`/`auth`, que además pierden brevemente su límite más estricto). Se prefirió así porque el throttler no tiene un fallback real como el de RBAC (no hay un "Postgres de respaldo" para contar requests) — fail-closed en el guard global habría significado el mismo radio de impacto del bug original (`503` en vez de `200`, pero igual de indisponible), solo que más rápido. Decisión del usuario, no una calibración de Fase 6.

**Sin telemetría de comandos Redis hoy**: el panel de Redis del dashboard "infra-use" está vacío, pero por un motivo distinto y ya documentado en el propio panel — `@opentelemetry/instrumentation-ioredis` no soporta la versión de `ioredis` instalada. No hay panel de Grafana que mostrar acá; no perder tiempo buscando uno.

## 1. Señal/Síntoma

- `/health/ready` falla o alerta `PlatformHealthCheckFailing` (`tooling/observability/alert-rules.yml`) dispara.
- Logs de `apps/api` con `[ioredis] Unhandled error event` o similar (conexión rechazada/timeout).
- Logs de `CachedRoleLookupAdapter` con `Redis get()/set()/del() fallo... se trata como cache-miss` — señal de degradación silenciosa de RBAC (funciona, pero más lento).
- Logs de `FailOpenThrottlerGuard` con `"Redis no disponible para el throttler, fail-open..."` — señal de que el rate limiting está temporalmente inactivo, NO de que la API esté caída (desde `#119`, la API sigue respondiendo con normalidad).
- Único signal confiable en Grafana hoy: `platform_health_ready` — no telemetría de comandos Redis (ver nota arriba).

## 2. Diagnóstico inmediato

1. `docker compose ps redis` — confirmar si el contenedor está corriendo y en qué estado (`healthy`/`unhealthy`/detenido).
2. `docker compose logs redis --tail 50` — buscar la causa (OOM del contenedor, crash, problema de red).
3. Si Redis está arriba pero `apps/api` no puede conectarse: confirmar `REDIS_URL` (namespace `redis` de `ConfigModule`) en el entorno de la réplica afectada — un valor mal configurado en un despliegue reciente es más común que Redis mismo estando caído. Afecta a ambos clientes por igual (mismo `REDIS_URL`).
4. Revisar logs de `CachedRoleLookupAdapter` para confirmar si RBAC está degradando silenciosamente (cache-miss constante) — eso ya es evidencia suficiente de que Redis está afectado, sin esperar a que `/health/ready` lo confirme.

## 3. Mitigación

- **Restaurar Redis sigue siendo la mitigación real para RBAC** (el cache-miss degrada, no bloquea, pero es más lento por request) — reiniciar el contenedor (`docker compose restart redis` en local; el mecanismo equivalente del orquestador en staging/producción). Redis no persiste estado de negocio crítico — el cache de permisos repuebla solo desde Postgres en el próximo miss, el throttler simplemente reinicia sus contadores — un reinicio limpio no pierde nada irrecuperable. **Verificado: la recuperación es automática** — `apps/api` no necesita reiniciarse.
- **El rate limiting ya no requiere mitigación de urgencia** (`#119`) — `FailOpenThrottlerGuard` mantiene la API respondiendo mientras Redis está caído, sin rate limiting activo. Restaurar Redis sigue siendo deseable para recuperar esa protección, pero ya no es una emergencia de disponibilidad.
- Mientras Redis está caído, `/health/ready` reportará no-listo y el balanceador dejará de enrutar tráfico a esa réplica (`docs/technical/08-DEVOPS.md §6`) — comportamiento correcto por diseño, y ya no oculta el hecho de que la réplica en realidad sigue sirviendo tráfico (con RBAC degradado y sin rate limiting) gracias a `#119`.
- `EnabledProductModules` (mitigación rápida de otros runbooks, `02-pool-de-conexiones-postgres-agotado.md`/`04-rollback-de-despliegue.md`) sigue sin ser necesaria acá — ya no hay un cuello de botella global que liberar.

## 4. Seguimiento de causa raíz

- Si Redis se cayó por OOM: revisar si el contenedor tiene un límite de memoria razonable configurado — no hay una política de eviction ni un límite documentado todavía en `docker-compose.yml`.
- Si fue un problema de red intermitente: confirmar que la política de reintento default de `CACHE_REDIS_CLIENT` (RBAC, sin cambios en `#119`) fue la adecuada.
- **Gap cerrado en `#119`**: `THROTTLER_REDIS_CLIENT` (fail-fast, separado de `CACHE_REDIS_CLIENT`) + `FailOpenThrottlerGuard` (`try/catch` alrededor de `handleRequest()`, fail-open ante cualquier error que no sea `ThrottlerException`) — ya no hay un mecanismo sin acotar. Si un incidente futuro revela que fail-open fue la elección equivocada para algún perfil de ruta (p. ej. si `auth` necesitara fail-closed específicamente), es una revisión de esa decisión explícita, no un bug.

## 5. Docs relacionados

- `docs/persistence/10-DECISIONES.md #104` — el gap original (RBAC/throttler en memoria).
- `docs/persistence/10-DECISIONES.md #106` — la migración a Redis que este runbook refleja.
- `docs/persistence/10-DECISIONES.md #114` — verificación en vivo del incidente de disponibilidad total (histórico — cerrado en `#119`).
- `docs/persistence/10-DECISIONES.md #119` — el fix: `THROTTLER_REDIS_CLIENT` + `FailOpenThrottlerGuard`, verificado en vivo.
- `docs/technical/07-SECURITY.md §5` — diseño del `ThrottlerGuard` con storage compartido.
- `docs/technical/03-BACKEND-ARCHITECTURE.md §10` — `/health/live` vs `/health/ready`.
