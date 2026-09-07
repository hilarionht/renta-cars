import { Controller, Get, Query } from '@nestjs/common';

import { RequestContext, RequiresProductModule } from '@platform/persistence-kernel';
import type {
  CustomerActivityResult,
  FleetUtilizationResult,
  ReservationFunnelResult,
  RevenueByBranchResult,
} from '@rental/reports/application';

import { CustomerActivityRequestDto } from './dto/customer-activity-request.dto';
import { ReportDateRangeRequestDto } from './dto/report-date-range-request.dto';
import { CustomerActivityHandler } from '../queries/customer-activity.handler';
import { FleetUtilizationHandler } from '../queries/fleet-utilization.handler';
import { ReservationFunnelHandler } from '../queries/reservation-funnel.handler';
import { RevenueByBranchHandler } from '../queries/revenue-by-branch.handler';

// docs/contracts/02-RESOURCE-CATALOG.md SS7 - "reports" son proyecciones de solo lectura,
// nunca la fuente de verdad de un hecho de negocio - ningun endpoint acepta POST/PATCH/
// DELETE. @RequiresProductModule('Rental') - mismo criterio que InvoicesController
// (scope:product-rental, gateado por modulo de producto habilitado).
@RequiresProductModule('Rental')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly revenueByBranch: RevenueByBranchHandler,
    private readonly fleetUtilization: FleetUtilizationHandler,
    private readonly reservationFunnel: ReservationFunnelHandler,
    private readonly customerActivity: CustomerActivityHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get('revenue-by-branch')
  async getRevenueByBranch(
    @Query() dto: ReportDateRangeRequestDto,
  ): Promise<RevenueByBranchResult> {
    const { companyId } = this.requestContext.get();
    return this.revenueByBranch.execute({ companyId, from: dto.from, to: dto.to });
  }

  @Get('fleet-utilization')
  async getFleetUtilization(
    @Query() dto: ReportDateRangeRequestDto,
  ): Promise<FleetUtilizationResult> {
    const { companyId } = this.requestContext.get();
    return this.fleetUtilization.execute({ companyId, from: dto.from, to: dto.to });
  }

  @Get('reservation-funnel')
  async getReservationFunnel(
    @Query() dto: ReportDateRangeRequestDto,
  ): Promise<ReservationFunnelResult> {
    const { companyId } = this.requestContext.get();
    return this.reservationFunnel.execute({ companyId, from: dto.from, to: dto.to });
  }

  @Get('customer-activity')
  async getCustomerActivity(
    @Query() dto: CustomerActivityRequestDto,
  ): Promise<CustomerActivityResult> {
    const { companyId } = this.requestContext.get();
    return this.customerActivity.execute({
      companyId,
      from: dto.from,
      to: dto.to,
      limit: dto.limit,
    });
  }
}
