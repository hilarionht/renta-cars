import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';

import { PrismaService } from '../prisma/prisma.service';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS10: dos endpoints, semantica distinta.
// Ambos publicos (sin JwtAuthGuard) y sin detalle interno mas alla de ok/degraded/down.
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly prismaService: PrismaService,
    private readonly redis: RedisHealthIndicator,
  ) {}

  // Solo confirma que el proceso responde - politica de reinicio del contenedor.
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  // Conectividad real a Postgres y Redis - admision de trafico del balanceador.
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prisma.pingCheck('postgres', this.prismaService),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
