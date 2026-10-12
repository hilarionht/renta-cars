import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  ContactInfo,
  Customer,
  type CustomerId,
  type CustomerType,
  CustomerName,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';

import { CUSTOMER_REPOSITORY, type CustomerRepository } from '../../ports/customer.repository';
import type { RegisterCustomerCommand } from './register-customer.command';

// customerType ya validado contra el catalogo cerrado en el DTO HTTP (@IsIn), no en el
// dominio - CustomerType es un alias de tipo, no una clase VO (mismo criterio que
// CompanyStatus/BranchStatus, decision del plan de implementacion).
@Injectable()
export class RegisterCustomerHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RegisterCustomerCommand): Promise<CustomerId> {
    const customer = Customer.create({
      companyId: command.companyId,
      name: CustomerName.from(command.name),
      taxIdOrDocumentId: TaxIdOrDocumentId.from(command.taxIdOrDocumentId),
      contactInfo: ContactInfo.from({ email: command.contactEmail, phone: command.contactPhone }),
      customerType: command.customerType as CustomerType,
    });

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

    return customer.id;
  }
}
