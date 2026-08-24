# Runbook: Redis caído

**Alcance real de Redis hoy** (actualizado tras Fase 6/Hardening "cache/performance", `docs/persistence/10-DECISIONES.md #106`): Redis ya no es solo el health check. Hay **2 clientes separados**, con tuning deliberadamente distinto:

- `HEALTH_REDIS_CLIENT` (`apps/api/src/app/redis/redis.provider.ts`) — respalda `/health/ready` exclusivamente. Fail-fast (`maxRetriesPerRequest: 1`, `connectTimeout: 2000`, `enableOfflineQueue: false`) — si Redis está caído, este cliente lo reporta rápido, sin colgar el health check.
- `CACHE_REDIS_CLIENT` (`libs/platform/persistence-kernel/src/redis-client.provider.ts`, `RedisCacheModule`) — respalda el cache de permisos RBAC (`CachedRoleLookupAdapter`) y el storage de `ThrottlerGuard` (`ThrottlerStorageRedisService`, `@nest-lab/throttler-storage-redis`). Política de reintento **default** de `ioredis` (más paciente, apropiada para no fallar una request de negocio solo porque Redis tardó un poco en responder).

**Impacto real hoy si Redis cae** (ya no es solo "degrada el health check"):

1. `/health/ready` reporta no-listo → el balanceador deja de enrutar tráfico a esa réplica (comportamiento correcto por diseño, `docs/technical/08-DEVOPS.md §6`).
2. **Permisos RBAC**: cada `get`/`set`/`del` contra `CACHE_REDIS_CLIENT` está envuelto en `try/catch` (`cached-role-lookup.adapter.ts`) — un error de Redis se trata como cache-miss, nunca como fallo de la request. `PermissionGuard` sigue funcionando, pero cae a resolver `roles[] → permissions[]` contra Postgres en **cada** request (más lento, nunca bloquea).
3. **Rate limiting**: `ThrottlerStorageRedisService` depende de un script Lua atómico contra Redis para `increment()` — si Redis no responde, el comportamiento exacto (excepción propagada vs. degradación) depende de la librería `@nest-lab/throttler-storage-redis`, no verificado en vivo en esta tanda (fuera de alcance: forzar una caída de Redis contra el paquete real no es parte de "cache/performance", ver `docs/persistence/10-DECISIONES.md #106`). Si en un incidente real `ThrottlerGuard` termina bloqueando requests por esto, es la primera pista a seguir.

**Sin telemetría de comandos Redis hoy**: el panel de Redis del dashboard "infra-use" está vacío, pero por un motivo distinto y ya documentado en el propio panel — `@opentelemetry/instrumentation-ioredis` no soporta la versión de `ioredis` instalada. No hay panel de Grafana que mostrar acá; no perder tiempo buscando uno.

## 1. Señal/Síntoma

- `/health/ready` falla o alerta `PlatformHealthCheckFailing` (`tooling/observability/alert-rules.yml`) dispara.
- Logs de `apps/api` con `[ioredis] Unhandled error event` o similar (conexión rechazada/timeout).
- Logs de `CachedRoleLookupAdapter` con `Redis get()/set()/del() fallo... se trata como cache-miss` — señal de degradación silenciosa de RBAC (funciona, pero más lento).
- Requests de auth/reservations empiezan a devolver `429` de forma inesperada, o dejan de limitarse del todo — posible síntoma de `ThrottlerStorageRedisService` fallando (ver punto 3 de arriba).
- Único signal confiable en Grafana hoy: `platform_health_ready` — no telemetría de comandos Redis (ver nota arriba).

## 2. Diagnóstico inmediato

1. `docker compose ps redis` — confirmar si el contenedor está corriendo y en qué estado (`healthy`/`unhealthy`/detenido).
2. `docker compose logs redis --tail 50` — buscar la causa (OOM del contenedor, crash, problema de red).
3. Si Redis está arriba pero `apps/api` no puede conectarse: confirmar `REDIS_URL` (namespace `redis` de `ConfigModule`) en el entorno de la réplica afectada — un valor mal configurado en un despliegue reciente es más común que Redis mismo estando caído. Afecta a ambos clientes por igual (mismo `REDIS_URL`).
4. Revisar logs de `CachedRoleLookupAdapter` para confirmar si RBAC está degradando silenciosamente (cache-miss constante) — eso ya es evidencia suficiente de que Redis está afectado, sin esperar a que `/health/ready` lo confirme.

## 3. Mitigación

- Reiniciar el contenedor de Redis (`docker compose restart redis` en local; el mecanismo equivalente del orquestador en staging/producción). Redis no persiste estado de negocio crítico — el cache de permisos repuebla solo desde Postgres en el próximo miss, el throttler simplemente reinicia sus contadores — un reinicio limpio no pierde nada irrecuperable.
- Mientras Redis está caído, `/health/ready` reportará no-listo y el balanceador dejará de enrutar tráfico a esa réplica (`docs/technical/08-DEVOPS.md §6`) — comportamiento correcto por diseño, no un bug a "arreglar" ocultando el chequeo.
- Si `ThrottlerGuard` empieza a bloquear tráfico legítimo por la caída de Redis (punto 3 de arriba, comportamiento no verificado del paquete): considerar `EnabledProductModules` para mitigar el módulo más afectado mientras se restaura Redis, mismo mecanismo de mitigación rápida que otros runbooks (`02-pool-de-conexiones-postgres-agotado.md`, `04-rollback-de-despliegue.md`).

## 4. Seguimiento de causa raíz

- Si Redis se cayó por OOM: revisar si el contenedor tiene un límite de memoria razonable configurado — no hay una política de eviction ni un límite documentado todavía en `docker-compose.yml`.
- Si fue un problema de red intermitente: confirmar que la política de reintento default de `CACHE_REDIS_CLIENT` fue la adecuada, o si el incidente sugiere que necesita su propio tuning (separado del fail-fast de `HEALTH_REDIS_CLIENT`, que ya está calibrado a propósito).
- **Verificar en vivo el comportamiento real de `ThrottlerStorageRedisService` ante una caída de Redis** (fail-open vs. fail-closed) — quedó explícitamente sin verificar en la tanda que introdujo este storage (`#106`), es el primer gap a cerrar si este runbook se usa en un incidente real.

## 5. Docs relacionados

- `docs/persistence/10-DECISIONES.md #104` — el gap original (RBAC/throttler en memoria).
- `docs/persistence/10-DECISIONES.md #106` — la migración a Redis que este runbook refleja.
- `docs/technical/07-SECURITY.md §5` — diseño del `ThrottlerGuard` con storage compartido.
- `docs/technical/03-BACKEND-ARCHITECTURE.md §10` — `/health/live` vs `/health/ready`.
