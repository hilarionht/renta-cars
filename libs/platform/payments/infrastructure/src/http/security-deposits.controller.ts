import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';

import { RequestContext, RequirePermission } from '@platform/persistence-kernel';
import {
  ReleaseSecurityDepositHandler,
  RetainSecurityDepositHandler,
  type SecurityDepositSummary,
} from '@platform/payments/application';

import { GetSecurityDepositHandler } from '../queries/get-security-deposit.handler';
import { ListSecurityDepositsHandler } from '../queries/list-security-deposits.handler';
import { RetainSecurityDepositRequestDto } from './dto/retain-security-deposit-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS5 - "security-deposits" es scope:platform, sin
// POST de creacion directa: hold() esta disparado unicamente por el listener de
// ReservationConfirmed.v1, nunca por un endpoint de cliente. release()/retain() SI son
// endpoints - override manual (Responsable Comercial/Financiero) ademas de ser disparados
// automaticamente por el listener de ReservationCheckedIn.v1.
@Controller('security-deposits')
export class SecurityDepositsController {
  constructor(
    private readonly releaseSecurityDeposit: ReleaseSecurityDepositHandler,
    private readonly retainSecurityDeposit: RetainSecurityDepositHandler,
    private readonly getSecurityDeposit: GetSecurityDepositHandler,
    private readonly listSecurityDeposits: ListSecurityDepositsHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get()
  async list(@Query('reservationId') reservationId?: string): Promise<SecurityDepositSummary[]> {
    const { companyId } = this.requestContext.get();
    const result = await this.listSecurityDeposits.execute({ companyId, reservationId });
    return result.items;
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<SecurityDepositSummary> {
    const { companyId } = this.requestContext.get();
    return this.getSecurityDeposit.execute({ companyId, securityDepositId: id });
  }

  @Post(':id/release')
  @RequirePermission('security-deposits:release')
  async release(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.releaseSecurityDeposit.execute({ companyId, securityDepositId: id });
  }

  @Post(':id/retain')
  @RequirePermission('security-deposits:retain')
  async retain(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RetainSecurityDepositRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.retainSecurityDeposit.execute({
      companyId,
      securityDepositId: id,
      retainedAmountMinorUnits: dto.retainedAmountMinorUnits,
      currency: dto.currency,
      reason: dto.reason,
    });
  }
}
