import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Token de inyeccion - docs/technical/09-CODING-STANDARDS.md SS1 (SCREAMING_SNAKE_CASE,
// Symbol). Cliente de Redis dedicado al storage de ThrottlerGuard, tuneado fail-fast (ver
// abajo) - mismo criterio exacto que HEALTH_REDIS_CLIENT (este mismo directorio), pero para
// el throttler en vez del health check. docs/persistence/10-DECISIONES.md #114 verifico en
// vivo que CACHE_REDIS_CLIENT (politica de reintento default de ioredis, apropiada para el
// cache de RBAC que comparte) hacia que una caida de Redis colgara ThrottlerGuard
// indefinidamente - y como ThrottlerGuard es un guard GLOBAL (APP_GUARD), eso colgaba TODA
// la API, no solo el rate limiting. Cliente separado para no tunear CACHE_REDIS_CLIENT (que
// SI necesita su politica de reintento actual para RolesPermissionsModule).
export const THROTTLER_REDIS_CLIENT = Symbol('ThrottlerRedisClient');

export const throttlerRedisProvider: Provider = {
  provide: THROTTLER_REDIS_CLIENT,
  useFactory: (configService: ConfigService) =>
    new Redis(configService.getOrThrow<string>('redis.url'), {
      // Mismos valores que HEALTH_REDIS_CLIENT: fallar rapido en vez de reintentar
      // indefinidamente con backoff creciente (la causa raiz verificada en #114). Combinado
      // con FailOpenThrottlerGuard (apps/api/src/app/throttler) - un fallo rapido acá se
      // traduce en fail-open (la request pasa sin rate limiting), nunca en un cuelgue.
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
    }),
  inject: [ConfigService],
};
