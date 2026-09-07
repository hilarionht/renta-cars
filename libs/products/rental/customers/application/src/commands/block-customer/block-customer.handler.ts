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
import type { BlockCustomerCommand } from './block-customer.command';

@Injectable()
export class BlockCustomerHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: BlockCustomerCommand): Promise<void> {
    const customerId: CustomerId = EntityId.from(command.customerId);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer || customer.companyId !== command.companyId) {
      throw new CustomerNotFoundError(command.customerId);
    }

    const versionBeforeBlock = customer.version;
    customer.block(command.reason);
    if (customer.version === versionBeforeBlock) {
      // No-op idempotente (ya Blocked) - ver docs/persistence/10-DECISIONES.md #56.
      return;
    }

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
