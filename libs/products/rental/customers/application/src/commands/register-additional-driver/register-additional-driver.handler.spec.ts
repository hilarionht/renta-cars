import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  ContactInfo,
  Customer,
  CustomerName,
  CustomerNotFoundError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';

import { RegisterAdditionalDriverHandler } from './register-additional-driver.handler';
import type { CustomerRepository } from '../../ports/customer.repository';

function createCustomer(): Customer {
  return Customer.create({
    companyId: 'company-1',
    name: CustomerName.from('Juan Perez'),
    taxIdOrDocumentId: TaxIdOrDocumentId.from('DOC-0001'),
    contactInfo: ContactInfo.from({ email: 'juan@example.com', phone: '+525512345678' }),
    customerType: 'Individual',
  });
}

function buildHandler(existingCustomer: Customer | null) {
  const customerRepository: CustomerRepository = {
    findById: jest.fn().mockResolvedValue(existingCustomer),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new RegisterAdditionalDriverHandler(
    customerRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, customerRepository, eventPublisher };
}

describe('RegisterAdditionalDriverHandler', () => {
  it('lanza CustomerNotFoundError si el customer no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        customerId: '018e5a00-0000-7000-8000-000000000000',
        companyId: 'company-1',
        name: 'Maria Lopez',
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('registra el driver, persiste y publica AdditionalDriverRegistered.v1', async () => {
    const customer = createCustomer();
    const { handler, customerRepository, eventPublisher } = buildHandler(customer);

    const driverId = await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      name: 'Maria Lopez',
    });

    expect(driverId).toBeDefined();
    expect(customer.allAdditionalDrivers).toHaveLength(1);
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'AdditionalDriverRegistered.v1' }),
    );
  });
});
