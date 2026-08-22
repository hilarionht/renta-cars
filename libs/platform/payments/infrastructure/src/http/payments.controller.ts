import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';

import { RequestContext } from '@platform/persistence-kernel';
import {
  AuthorizePaymentHandler,
  CapturePaymentHandler,
  RefundPaymentHandler,
  RequestPaymentHandler,
  type PaymentSummary,
} from '@platform/payments/application';

import { GetPaymentHandler } from '../queries/get-payment.handler';
import { ListPaymentsHandler } from '../queries/list-payments.handler';
import { RequestPaymentRequestDto } from './dto/request-payment-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md - "payments" es scope:platform, sin
// @RequiresProductModule() (mismo criterio que Calendar/Files: no gateado por
// EnabledProductModules).
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly requestPayment: RequestPaymentHandler,
    private readonly authorizePayment: AuthorizePaymentHandler,
    private readonly capturePayment: CapturePaymentHandler,
    private readonly refundPayment: RefundPaymentHandler,
    private readonly getPayment: GetPaymentHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
  async request(@Body() dto: RequestPaymentRequestDto): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const id = await this.requestPayment.execute({
      companyId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      amountMinorUnits: dto.amountMinorUnits,
      currency: dto.currency,
      method: dto.method,
      idempotencyKey: dto.idempotencyKey,
    });
    return { id: id.toString() };
  }

  @Get()
  async list(
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
  ): Promise<PaymentSummary[]> {
    const { companyId } = this.requestContext.get();
    const result = await this.listPayments.execute({ companyId, targetType, targetId });
    return result.items;
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<PaymentSummary> {
    const { companyId } = this.requestContext.get();
    return this.getPayment.execute({ companyId, paymentId: id });
  }

  @Post(':id/authorize')
  async authorize(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.authorizePayment.execute({ companyId, paymentId: id });
  }

  @Post(':id/capture')
  async capture(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.capturePayment.execute({ companyId, paymentId: id });
  }

  @Post(':id/refund')
  async refund(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.refundPayment.execute({ companyId, paymentId: id });
  }
}
