# Runbook: Redis caído

**Alcance real de Redis hoy** (actualizado tras Fase 6/Hardening "cache/performance", `docs/persistence/10-DECISIONES.md #106`): Redis ya no es solo el health check. Hay **2 clientes separados**, con tuning deliberadamente distinto:

- `HEALTH_REDIS_CLIENT` (`apps/api/src/app/redis/redis.provider.ts`) — respalda `/health/ready` exclusivamente. Fail-fast (`maxRetriesPerRequest: 1`, `connectTimeout: 2000`, `enableOfflineQueue: false`) — si Redis está caído, este cliente lo reporta rápido, sin colgar el health check.
- `CACHE_REDIS_CLIENT` (`libs/platform/persistence-kernel/src/redis-client.provider.ts`, `RedisCacheModule`) — respalda el cache de permisos RBAC (`CachedRoleLookupAdapter`) y el storage de `ThrottlerGuard` (`ThrottlerStorageRedisService`, `@nest-lab/throttler-storage-redis`). Política de reintento **default** de `ioredis` (más paciente, apropiada para no fallar una request de negocio solo porque Redis tardó un poco en responder).

**Impacto real hoy si Redis cae** (verificado en vivo, `docs/persistence/10-DECISIONES.md #114` — ya no es "degrada el health check", ni siquiera "degrada el rate limiting"):

1. `/health/ready` reporta no-listo → el balanceador deja de enrutar tráfico a esa réplica (comportamiento correcto por diseño, `docs/technical/08-DEVOPS.md §6`).
2. **Permisos RBAC**: cada `get`/`set`/`del` contra `CACHE_REDIS_CLIENT` está envuelto en `try/catch` (`cached-role-lookup.adapter.ts`) — un error de Redis se trata como cache-miss, nunca como fallo de la request. `PermissionGuard` sigue funcionando, pero cae a resolver `roles[] → permissions[]` contra Postgres en **cada** request (más lento, nunca bloquea).
3. **Rate limiting — INCIDENTE DE DISPONIBILIDAD TOTAL, no degradación**: `ThrottlerGuard.canActivate()` (`@nestjs/throttler`) llama `storage.increment()` sin ningún `try/catch` — confirmado leyendo `node_modules/@nestjs/throttler/dist/throttler.guard.js`. `CACHE_REDIS_CLIENT` usa la política de reintento **default** de `ioredis` (sin `maxRetriesPerRequest`/`connectTimeout` propios, deliberado — ver `redis-client.provider.ts`), que reintenta reconectar indefinidamente con backoff creciente en vez de fallar rápido. **Verificado en vivo** (`docker compose stop redis` con `apps/api` corriendo, request real a un endpoint bajo el throttler global): la request quedó colgada **más de 90 segundos sin ninguna respuesta** (ni éxito, ni error, ni timeout) — no es "fail-open" ni "fail-closed", es un cuelgue indefinido. **Causa raíz arquitectónica, no solo de configuración**: en NestJS los Guards corren **antes** que los Interceptors — `TimeoutInterceptor` (10s, `apps/api/src/app/interceptors/timeout.interceptor.ts`) envuelve la invocación del handler, que nunca arranca mientras el Guard no resuelve. El timeout de la app **no protege contra un Guard colgado**, sin importar su valor. Con el throttler `general` aplicado globalmente (`app.module.ts`), esto significa que **una caída de Redis deja toda la API sin responder**, no solo degrada el rate limiting. Recuperación: automática y rápida una vez Redis vuelve a estar arriba (verificado: request nueva resuelta en <200ms sin reiniciar `apps/api`), pero mientras Redis está caído, cero requests bajo el throttler global se completan.

**Sin telemetría de comandos Redis hoy**: el panel de Redis del dashboard "infra-use" está vacío, pero por un motivo distinto y ya documentado en el propio panel — `@opentelemetry/instrumentation-ioredis` no soporta la versión de `ioredis` instalada. No hay panel de Grafana que mostrar acá; no perder tiempo buscando uno.

## 1. Señal/Síntoma

- `/health/ready` falla o alerta `PlatformHealthCheckFailing` (`tooling/observability/alert-rules.yml`) dispara.
- Logs de `apps/api` con `[ioredis] Unhandled error event` o similar (conexión rechazada/timeout).
- Logs de `CachedRoleLookupAdapter` con `Redis get()/set()/del() fallo... se trata como cache-miss` — señal de degradación silenciosa de RBAC (funciona, pero más lento).
- **Toda la API deja de responder** (no solo auth/reservations) — requests bajo el throttler global (prácticamente todas) se cuelgan sin devolver nada, ni siquiera un error, mientras Redis esté caído (verificado, ver punto 3 de arriba). Esto es indistinguible externamente de "la API está caída" — no esperar un `503`/`429` como señal, el síntoma real es ausencia total de respuesta.
- Único signal confiable en Grafana hoy: `platform_health_ready` — no telemetría de comandos Redis (ver nota arriba).

## 2. Diagnóstico inmediato

1. `docker compose ps redis` — confirmar si el contenedor está corriendo y en qué estado (`healthy`/`unhealthy`/detenido).
2. `docker compose logs redis --tail 50` — buscar la causa (OOM del contenedor, crash, problema de red).
3. Si Redis está arriba pero `apps/api` no puede conectarse: confirmar `REDIS_URL` (namespace `redis` de `ConfigModule`) en el entorno de la réplica afectada — un valor mal configurado en un despliegue reciente es más común que Redis mismo estando caído. Afecta a ambos clientes por igual (mismo `REDIS_URL`).
4. Revisar logs de `CachedRoleLookupAdapter` para confirmar si RBAC está degradando silenciosamente (cache-miss constante) — eso ya es evidencia suficiente de que Redis está afectado, sin esperar a que `/health/ready` lo confirme.

## 3. Mitigación

- **Restaurar Redis es la única mitigación real** — no hay circuit breaker ni fallback hoy (`#114`). Reiniciar el contenedor (`docker compose restart redis` en local; el mecanismo equivalente del orquestador en staging/producción). Redis no persiste estado de negocio crítico — el cache de permisos repuebla solo desde Postgres en el próximo miss, el throttler simplemente reinicia sus contadores — un reinicio limpio no pierde nada irrecuperable. **Verificado: la recuperación es automática** — `apps/api` no necesita reiniciarse, la próxima request después de que Redis vuelve resuelve normalmente (<200ms en la prueba en vivo).
- Mientras Redis está caído, `/health/ready` reportará no-listo y el balanceador dejará de enrutar tráfico a esa réplica (`docs/technical/08-DEVOPS.md §6`) — comportamiento correcto por diseño, pero **no protege**: las réplicas que ya tenían conexiones/tráfico en curso igual se cuelgan, y una réplica marcada no-lista sigue aceptando nuevas conexiones TCP hasta que el balanceador reacciona.
- `EnabledProductModules` (mitigación rápida de otros runbooks, `02-pool-de-conexiones-postgres-agotado.md`/`04-rollback-de-despliegue.md`) **no ayuda acá** — el throttler `general` está en el guard global, corre para TODA request autenticada o pública, deshabilitar un módulo de producto no libera el cuello de botella.

## 4. Seguimiento de causa raíz

- Si Redis se cayó por OOM: revisar si el contenedor tiene un límite de memoria razonable configurado — no hay una política de eviction ni un límite documentado todavía en `docker-compose.yml`.
- Si fue un problema de red intermitente: confirmar que la política de reintento default de `CACHE_REDIS_CLIENT` fue la adecuada, o si el incidente sugiere que necesita su propio tuning (separado del fail-fast de `HEALTH_REDIS_CLIENT`, que ya está calibrado a propósito).
- **Gap real, verificado, no resuelto** (`#114`): no existe ningún mecanismo que acote la espera de `ThrottlerGuard` cuando Redis no responde — ni `maxRetriesPerRequest`/`connectTimeout` en `CACHE_REDIS_CLIENT`, ni un `try/catch` en el guard, ni un circuit breaker. Arreglar esto requiere una decisión de diseño real (tunear el cliente compartido con RBAC afecta a los 2 consumidores por igual; un cliente separado para el throttler, mismo criterio que `HEALTH_REDIS_CLIENT` vs `CACHE_REDIS_CLIENT`, es la opción más limpia pero no se construyó en esta tanda — alcance era verificar y documentar, no corregir).

## 5. Docs relacionados

- `docs/persistence/10-DECISIONES.md #104` — el gap original (RBAC/throttler en memoria).
- `docs/persistence/10-DECISIONES.md #106` — la migración a Redis que este runbook refleja.
- `docs/persistence/10-DECISIONES.md #114` — verificación en vivo del comportamiento real ante una caída de Redis (este runbook, actualizado con los hallazgos).
- `docs/technical/07-SECURITY.md §5` — diseño del `ThrottlerGuard` con storage compartido.
- `docs/technical/03-BACKEND-ARCHITECTURE.md §10` — `/health/live` vs `/health/ready`.
