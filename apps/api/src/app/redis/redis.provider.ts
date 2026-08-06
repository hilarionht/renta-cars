import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Token de inyeccion - docs/technical/09-CODING-STANDARDS.md SS1 (SCREAMING_SNAKE_CASE,
// Symbol). Cliente unico de Redis para lo que hoy lo necesita (health check); el paso 8
// del bootstrap formaliza esto bajo el namespace `redis` de ConfigModule.
export const REDIS_CLIENT = Symbol('RedisClient');

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) =>
    new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      // Ajustado para el uso de hoy (health check): debe fallar rapido, no encolar
      // comandos indefinidamente mientras Redis esta caido - de lo contrario
      // /health/ready se queda colgado en vez de responder "down" (verificado a mano
      // deteniendo el contenedor de Redis). El paso 8 revisita esto si un uso de negocio
      // (cache, ThrottlerGuard) necesita una politica de reintento distinta.
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
    }),
  inject: [ConfigService],
};
