import { Module } from '@nestjs/common';

import { CustomerActivityHandler } from './queries/customer-activity.handler';
import { FleetUtilizationHandler } from './queries/fleet-utilization.handler';
import { ReservationFunnelHandler } from './queries/reservation-funnel.handler';
import { RevenueByBranchHandler } from './queries/revenue-by-branch.handler';
import { ReportsController } from './http/reports.controller';

// Sin imports cross-modulo: los 4 Query Handlers leen Prisma directo via ReadTransaction
// (ADR-0007, "proyecciones optimizadas... sin pasar por el modelo de dominio completo"),
// nunca consumen un puerto de otro modulo. Sin providers de repositorio (reports no tiene
// agregados propios, docs/technical/01-MONOREPO.md SS3.1).
@Module({
  controllers: [ReportsController],
  providers: [
    RevenueByBranchHandler,
    FleetUtilizationHandler,
    ReservationFunnelHandler,
    CustomerActivityHandler,
  ],
})
export class ReportsModule {}
