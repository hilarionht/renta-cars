import { Module } from '@nestjs/common';

import { NotificationsModule } from '@platform/notifications/infrastructure';
import { CustomersModule } from '@rental/customers/infrastructure';
import {
  INVOICE_NUMBER_GENERATOR_PORT,
  INVOICE_REPOSITORY,
  IssueInvoiceHandler,
  VoidInvoiceHandler,
} from '@rental/invoices/application';

import { InvoiceIssuedFromCheckInListener } from './events/invoice-issued-from-check-in.listener';
import { InvoiceIssuedNotificationListener } from './events/invoice-issued-notification.listener';
import { InvoicesController } from './http/invoices.controller';
import { PrismaInvoiceNumberGeneratorAdapter } from './persistence/prisma/prisma-invoice-number-generator.adapter';
import { PrismaInvoiceRepository } from './persistence/prisma/prisma-invoice.repository';
import { GetInvoiceHandler } from './queries/get-invoice.handler';
import { ListInvoicesHandler } from './queries/list-invoices.handler';

// customerId/reservationId llegan opacos desde el evento ReservationCheckedIn.v1
// (docs/model/09-DEPENDENCIES.md SS4, el evento es la unica superficie de datos que
// Invoices puede consumir de Reservation) - IssueInvoiceHandler no necesita
// CUSTOMER_LOOKUP_PORT. CustomersModule/NotificationsModule agregados en Fase 3 item 3
// (docs/persistence/10-DECISIONES.md #98) solo para InvoiceIssuedNotificationListener -
// mismo patron que Reservations (servicio de plataforma, no un modulo de negocio par;
// Notifications no puede alcanzar CustomerLookupPort por si sola, boundaries.mjs). Sin
// exports: la relacion Reservations->Invoices sigue siendo unidireccional via evento, nunca
// al reves.
@Module({
  imports: [CustomersModule, NotificationsModule],
  controllers: [InvoicesController],
  providers: [
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
    { provide: INVOICE_NUMBER_GENERATOR_PORT, useClass: PrismaInvoiceNumberGeneratorAdapter },
    IssueInvoiceHandler,
    VoidInvoiceHandler,
    GetInvoiceHandler,
    ListInvoicesHandler,
    InvoiceIssuedFromCheckInListener,
    InvoiceIssuedNotificationListener,
  ],
})
export class InvoicesModule {}
