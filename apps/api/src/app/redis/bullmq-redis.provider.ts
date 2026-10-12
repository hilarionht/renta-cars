import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Token de inyeccion - docs/technical/09-CODING-STANDARDS.md SS1 (SCREAMING_SNAKE_CASE,
// Symbol). Cliente Redis dedicado para BullMQ (docs/persistence/10-DECISIONES.md #121,
// primera instalacion real de BullMQ en este repo) - mismo criterio de aislamiento ya usado
// 2 veces esta sesion (HEALTH_REDIS_CLIENT/CACHE_REDIS_CLIENT/THROTTLER_REDIS_CLIENT).
// maxRetriesPerRequest: null NO es una preferencia - es un requisito duro documentado de
// BullMQ: usa comandos bloqueantes de Redis (BRPOPLPUSH/BLMOVE) que fallarian si ioredis
// reintenta con el limite default. Sin este valor, BullMQ lanza un error explicito al
// arrancar.
export const BULLMQ_REDIS_CLIENT = Symbol('BullmqRedisClient');

export const bullmqRedisProvider: Provider = {
  provide: BULLMQ_REDIS_CLIENT,
  useFactory: (configService: ConfigService) =>
    new Redis(configService.getOrThrow<string>('redis.url'), {
      maxRetriesPerRequest: null,
    }),
  inject: [ConfigService],
};
