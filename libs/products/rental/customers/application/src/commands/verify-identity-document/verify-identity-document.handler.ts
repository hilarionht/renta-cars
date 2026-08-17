import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { type CustomerId, CustomerNotFoundError } from '@rental/customers/domain';

import { CUSTOMER_REPOSITORY, type CustomerRepository } from '../../ports/customer.repository';
import type { VerifyIdentityDocumentCommand } from './verify-identity-document.command';

@Injectable()
export class VerifyIdentityDocumentHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: VerifyIdentityDocumentCommand): Promise<void> {
    const customerId: CustomerId = EntityId.from(command.customerId);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer || customer.companyId !== command.companyId) {
      throw new CustomerNotFoundError(command.customerId);
    }

    customer.verifyIdentityDocument(command.documentId);

    await this.unitOfWork.run(async (tx) => {
      await this.customerRepository.save(customer, tx);
      for (const event of customer.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Customer',
          aggregateId: customer.id.toString(),
          companyId: customer.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
