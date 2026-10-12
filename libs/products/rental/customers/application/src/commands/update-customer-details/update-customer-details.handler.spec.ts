import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  ContactInfo,
  Customer,
  CustomerName,
  CustomerNotFoundError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';

import { UpdateCustomerDetailsHandler } from './update-customer-details.handler';
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
    findByCompanyIdAndPhone: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new UpdateCustomerDetailsHandler(customerRepository, unitOfWork, eventPublisher);

  return { handler, customerRepository };
}

describe('UpdateCustomerDetailsHandler', () => {
  it('lanza CustomerNotFoundError si el customer no existe', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        customerId: '018e5a00-0000-7000-8000-000000000000',
        companyId: 'company-1',
        name: 'Otro Nombre',
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('lanza CustomerNotFoundError si el customer pertenece a otra company', async () => {
    const customer = createCustomer();
    const { handler } = buildHandler(customer);

    await expect(
      handler.execute({
        customerId: customer.id.toString(),
        companyId: 'otra-company',
        name: 'Otro Nombre',
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('actualiza solo los campos provistos y persiste', async () => {
    const customer = createCustomer();
    const { handler, customerRepository } = buildHandler(customer);

    await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      name: 'Nuevo Nombre',
    });

    expect(customer.name.toString()).toBe('Nuevo Nombre');
    expect(customer.contactInfo.toEmail().toString()).toBe('juan@example.com');
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
  });
});
