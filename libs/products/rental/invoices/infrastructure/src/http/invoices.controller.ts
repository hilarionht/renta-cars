import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';

import {
  RequestContext,
  RequirePermission,
  RequiresProductModule,
} from '@platform/persistence-kernel';
import { VoidInvoiceHandler, type InvoiceSummary } from '@rental/invoices/application';

import { GetInvoiceHandler } from '../queries/get-invoice.handler';
import { ListInvoicesHandler } from '../queries/list-invoices.handler';
import { VoidInvoiceRequestDto } from './dto/void-invoice-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS5 - unicas operaciones de cliente: lectura y
// void() (emision es automatica, reactiva a ReservationCheckedIn.v1 - nunca un POST de
// cliente, mismo criterio que SecurityDeposit.hold()). @RequiresProductModule('Rental') -
// mismo criterio que ReservationsController (scope:product-rental, gateado por modulo de
// producto habilitado).
@RequiresProductModule('Rental')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly voidInvoice: VoidInvoiceHandler,
    private readonly getInvoice: GetInvoiceHandler,
    private readonly listInvoices: ListInvoicesHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get()
  async list(@Query('reservationId') reservationId?: string): Promise<InvoiceSummary[]> {
    const { companyId } = this.requestContext.get();
    const result = await this.listInvoices.execute({ companyId, reservationId });
    return result.items;
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceSummary> {
    const { companyId } = this.requestContext.get();
    return this.getInvoice.execute({ companyId, invoiceId: id });
  }

  @Post(':id/void')
  @RequirePermission('invoices:void')
  async void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.voidInvoice.execute({ companyId, invoiceId: id, reason: dto.reason });
  }
}
