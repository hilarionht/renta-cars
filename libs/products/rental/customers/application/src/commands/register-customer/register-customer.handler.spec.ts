import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { Customer } from '@rental/customers/domain';

import { RegisterCustomerHandler } from './register-customer.handler';
import type { CustomerRepository } from '../../ports/customer.repository';

function buildHandler() {
  const savedCustomers: Customer[] = [];
  const customerRepository: CustomerRepository = {
    findById: jest.fn(),
    save: jest.fn((customer: Customer) => {
      savedCustomers.push(customer);
      return Promise.resolve();
    }),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new RegisterCustomerHandler(customerRepository, unitOfWork, eventPublisher);

  return { handler, customerRepository, unitOfWork, eventPublisher, savedCustomers };
}

describe('RegisterCustomerHandler', () => {
  it('crea el customer, lo persiste dentro de UnitOfWork.run() y publica CustomerRegistered.v1', async () => {
    const { handler, customerRepository, eventPublisher, savedCustomers } = buildHandler();

    const customerId = await handler.execute({
      companyId: 'company-1',
      name: 'Juan Perez',
      taxIdOrDocumentId: 'DOC-0001',
      contactEmail: 'juan@example.com',
      contactPhone: '+525512345678',
      customerType: 'Individual',
    });

    expect(customerId.toString()).toBeDefined();
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
    expect(savedCustomers).toHaveLength(1);
    expect(savedCustomers[0].name.toString()).toBe('Juan Perez');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'CustomerRegistered.v1',
        aggregateType: 'Customer',
        companyId: 'company-1',
      }),
    );
  });
});
