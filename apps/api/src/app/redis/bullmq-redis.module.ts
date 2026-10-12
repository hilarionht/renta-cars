import { Module } from '@nestjs/common';

import { BULLMQ_REDIS_CLIENT, bullmqRedisProvider } from './bullmq-redis.provider';

// Modulo estatico simple, mismo motivo que ThrottlerRedisModule/RedisCacheModule:
// BullModule.forRootAsync() crea su propio modulo dinamico, y su useFactory solo puede
// resolver via `inject` lo que sus propios `imports` exportan.
@Module({
  providers: [bullmqRedisProvider],
  exports: [BULLMQ_REDIS_CLIENT],
})
export class BullmqRedisModule {}
