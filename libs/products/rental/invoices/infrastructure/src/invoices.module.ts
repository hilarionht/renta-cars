import { Module } from '@nestjs/common';

import {
  INVOICE_NUMBER_GENERATOR_PORT,
  INVOICE_REPOSITORY,
  IssueInvoiceHandler,
  VoidInvoiceHandler,
} from '@rental/invoices/application';

import { InvoiceIssuedFromCheckInListener } from './events/invoice-issued-from-check-in.listener';
import { InvoicesController } from './http/invoices.controller';
import { PrismaInvoiceNumberGeneratorAdapter } from './persistence/prisma/prisma-invoice-number-generator.adapter';
import { PrismaInvoiceRepository } from './persistence/prisma/prisma-invoice.repository';
import { GetInvoiceHandler } from './queries/get-invoice.handler';
import { ListInvoicesHandler } from './queries/list-invoices.handler';

// Sin imports cross-modulo: customerId/reservationId llegan opacos desde el evento
// ReservationCheckedIn.v1 (docs/model/09-DEPENDENCIES.md SS4, el evento es la unica
// superficie de datos que Invoices puede consumir de Reservation) - no hace falta
// CUSTOMER_LOOKUP_PORT esta tanda. Sin exports: la relacion Reservations->Invoices es
// unidireccional via evento, nunca al reves.
@Module({
  controllers: [InvoicesController],
  providers: [
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
    { provide: INVOICE_NUMBER_GENERATOR_PORT, useClass: PrismaInvoiceNumberGeneratorAdapter },
    IssueInvoiceHandler,
    VoidInvoiceHandler,
    GetInvoiceHandler,
    ListInvoicesHandler,
    InvoiceIssuedFromCheckInListener,
  ],
})
export class InvoicesModule {}
