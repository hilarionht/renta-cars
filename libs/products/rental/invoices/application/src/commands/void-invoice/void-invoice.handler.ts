import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { InvoiceNotFoundError } from '@rental/invoices/domain';

import { INVOICE_REPOSITORY, type InvoiceRepository } from '../../ports/invoice.repository';
import type { VoidInvoiceCommand } from './void-invoice.command';

@Injectable()
export class VoidInvoiceHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: VoidInvoiceCommand): Promise<void> {
    const invoice = await this.invoiceRepository.findById(EntityId.from(command.invoiceId));
    if (!invoice || invoice.companyId !== command.companyId) {
      throw new InvoiceNotFoundError(command.invoiceId);
    }

    invoice.void(command.reason);

    await this.unitOfWork.run(async (tx) => {
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
  }
}
