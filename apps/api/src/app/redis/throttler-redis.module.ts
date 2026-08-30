import { Module } from '@nestjs/common';

import { THROTTLER_REDIS_CLIENT, throttlerRedisProvider } from './throttler-redis.provider';

// Modulo estatico simple, mismo motivo que RedisCacheModule (@platform/persistence-kernel):
// ThrottlerModule.forRootAsync() crea su propio modulo dinamico, y su useFactory solo puede
// resolver via `inject` lo que sus propios `imports` exportan - un provider suelto en
// AppModule.providers no alcanza (mismo bug de UnknownDependenciesException ya documentado
// en el comentario de ThrottlerModule.forRootAsync en app.module.ts).
@Module({
  providers: [throttlerRedisProvider],
  exports: [THROTTLER_REDIS_CLIENT],
})
export class ThrottlerRedisModule {}
