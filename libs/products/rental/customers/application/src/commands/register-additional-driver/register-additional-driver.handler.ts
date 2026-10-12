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
import type { RegisterAdditionalDriverCommand } from './register-additional-driver.command';

@Injectable()
export class RegisterAdditionalDriverHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RegisterAdditionalDriverCommand): Promise<string> {
    const customerId: CustomerId = EntityId.from(command.customerId);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer || customer.companyId !== command.companyId) {
      throw new CustomerNotFoundError(command.customerId);
    }

    const driverId = customer.registerAdditionalDriver(command.name);

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

    return driverId.toString();
  }
}
