import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Token de inyeccion - docs/technical/09-CODING-STANDARDS.md SS1 (SCREAMING_SNAKE_CASE,
// Symbol). Cliente Redis compartido para cache/rate-limiting (Fase 6/Hardening
// "cache/performance") - distinto del cliente de apps/api/src/app/redis/redis.provider.ts
// (HEALTH_REDIS_CLIENT), que esta deliberadamente tuneado fail-fast solo para el health
// check. Este vive en persistence-kernel (no en apps/api) porque los 2 consumidores reales
// son RolesPermissionsModule (cache de permisos, libs/) y AppModule (storage de
// ThrottlerGuard) - libs/ no puede importar apps/api (tooling/eslint/boundaries.mjs), mismo
// motivo estructural que RequirePermission/throttle-profiles en este mismo directorio.
// Politica de reintento DEFAULT de ioredis (sin maxRetriesPerRequest/enableOfflineQueue
// custom) - a diferencia del health check, una espera breve por reintento es preferible a
// fallar la request: un miss de cache por timeout cae a Postgres igual, nunca bloquea.
export const CACHE_REDIS_CLIENT = Symbol('CacheRedisClient');

export const redisClientProvider: Provider = {
  provide: CACHE_REDIS_CLIENT,
  useFactory: (configService: ConfigService) =>
    new Redis(configService.getOrThrow<string>('redis.url')),
  inject: [ConfigService],
};
