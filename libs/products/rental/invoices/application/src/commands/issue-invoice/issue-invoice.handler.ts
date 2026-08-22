import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  Money,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  Invoice,
  InvoiceAlreadyIssuedError,
  type InvoiceId,
  InvoiceNumber,
  TaxDetails,
} from '@rental/invoices/domain';

import {
  INVOICE_NUMBER_GENERATOR_PORT,
  type InvoiceNumberGeneratorPort,
} from '../../ports/invoice-number-generator.port';
import { INVOICE_REPOSITORY, type InvoiceRepository } from '../../ports/invoice.repository';
import type { IssueInvoiceCommand } from './issue-invoice.command';

// docs/model/05-DOMAIN_SERVICES.md SS4.5: sin TaxDetails real todavia (RN-23 dependiente de
// pais, sin motor de calculo documentado) - se emite siempre TaxDetails.zero().
@Injectable()
export class IssueInvoiceHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository,
    @Inject(INVOICE_NUMBER_GENERATOR_PORT)
    private readonly numberGenerator: InvoiceNumberGeneratorPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: IssueInvoiceCommand): Promise<InvoiceId> {
    const existing = await this.invoiceRepository.findByReservationId(command.reservationId);
    if (existing) {
      throw new InvoiceAlreadyIssuedError(command.reservationId);
    }

    let invoice!: Invoice;
    await this.unitOfWork.run(async (tx) => {
      const rawNumber = await this.numberGenerator.nextNumber(command.companyId, tx);
      invoice = Invoice.issue({
        companyId: command.companyId,
        reservationId: command.reservationId,
        customerId: command.customerId,
        invoiceNumber: InvoiceNumber.from(rawNumber),
        taxDetails: TaxDetails.zero(),
        charges: command.charges.map((charge) => ({
          kind: charge.kind,
          amount: Money.from(charge.amountMinorUnits, charge.currency),
          description: charge.description,
        })),
      });

      await this.invoiceRepository.save(invoice, tx);
      for (const event of invoice.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Invoice',
          aggregateId: invoice.id.toString(),
          companyId: invoice.companyId,
          payload: { ...event },
        });
      }
    });

    return invoice.id;
  }
}
