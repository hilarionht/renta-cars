import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  ContactInfo,
  Customer,
  CustomerName,
  CustomerNotFoundError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';

import { RegisterCustomerPushTokenHandler } from './register-customer-push-token.handler';
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

  const handler = new RegisterCustomerPushTokenHandler(
    customerRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, customerRepository };
}

describe('RegisterCustomerPushTokenHandler', () => {
  it('lanza CustomerNotFoundError si el customer no existe', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        customerId: '018e5a00-0000-7000-8000-000000000000',
        companyId: 'company-1',
        deviceToken: 'ExponentPushToken[abc]',
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
        deviceToken: 'ExponentPushToken[abc]',
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('registra el deviceToken y persiste', async () => {
    const customer = createCustomer();
    const { handler, customerRepository } = buildHandler(customer);

    await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      deviceToken: 'ExponentPushToken[abc]',
    });

    expect(customer.pushDeviceToken).toBe('ExponentPushToken[abc]');
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
  });

  it('deviceToken null limpia un token ya registrado', async () => {
    const customer = createCustomer();
    customer.registerPushToken('ExponentPushToken[abc]');
    const { handler, customerRepository } = buildHandler(customer);

    await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      deviceToken: null,
    });

    expect(customer.pushDeviceToken).toBeUndefined();
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
  });
});
