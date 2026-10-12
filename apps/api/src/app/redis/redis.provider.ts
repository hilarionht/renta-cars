import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Token de inyeccion - docs/technical/09-CODING-STANDARDS.md SS1 (SCREAMING_SNAKE_CASE,
// Symbol). Cliente de Redis dedicado al health check, tuneado fail-fast (ver abajo) -
// distinto del cliente compartido de cache/throttler (CACHE_REDIS_CLIENT,
// @platform/persistence-kernel, Fase 6/Hardening "cache/performance") que usa la politica
// de reintento default de ioredis, apropiada para una espera breve en vez de fallar la
// request. Nombrado HEALTH_REDIS_CLIENT (no solo REDIS_CLIENT) a proposito - dos tokens
// Symbol con el mismo nombre/descripcion son indistinguibles en un stack trace de
// "Cannot resolve dependency".
export const HEALTH_REDIS_CLIENT = Symbol('HealthRedisClient');

export const redisProvider: Provider = {
  provide: HEALTH_REDIS_CLIENT,
  useFactory: (configService: ConfigService) =>
    new Redis(configService.getOrThrow<string>('redis.url'), {
      // Ajustado para el uso de hoy (health check): debe fallar rapido, no encolar
      // comandos indefinidamente mientras Redis esta caido - de lo contrario
      // /health/ready se queda colgado en vez de responder "down" (verificado a mano
      // deteniendo el contenedor de Redis).
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
    }),
  inject: [ConfigService],
};
