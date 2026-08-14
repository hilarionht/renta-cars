import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { metrics } from '@opentelemetry/api';

import { PrismaService } from '@platform/persistence-kernel';

import { RedisHealthIndicator } from './indicators/redis.health-indicator';

// docs/technical/06-OBSERVABILITY.md SS5: ambos endpoints emiten platform_health_ready
// (0/1) - permite a un dashboard/alerta distinguir "proceso caido" de "proceso vivo pero
// degradado" sin depender solo de scraping HTTP externo.
const healthReadyGauge = metrics.getMeter('api').createGauge('platform_health_ready', {
  description: 'Estado de /health/ready (1 = ok, 0 = degradado o caido)',
});

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
  async ready() {
    try {
      const result = await this.health.check([
        () => this.prisma.pingCheck('postgres', this.prismaService),
        () => this.redis.isHealthy('redis'),
      ]);
      healthReadyGauge.record(1);
      return result;
    } catch (error) {
      healthReadyGauge.record(0);
      throw error;
    }
  }
}
