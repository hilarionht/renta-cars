import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { PrismaService } from '../prisma/prisma.service';
import { redisProvider } from '../redis/redis.provider';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaService, redisProvider, RedisHealthIndicator],
})
export class HealthModule {}
