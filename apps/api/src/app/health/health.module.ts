import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { redisProvider } from '../redis/redis.provider';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

// PrismaService ahora viene de PrismaModule (global, apps/api/src/app/persistence) - no se
// vuelve a listar aca.
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [redisProvider, RedisHealthIndicator],
})
export class HealthModule {}
