import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  AdditionalDriverMissingValidLicenseError,
  ContactInfo,
  Customer,
  CustomerName,
  CustomerNotFoundError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';

import { ValidateAdditionalDriverLicenseHandler } from './validate-additional-driver-license.handler';
import type { CustomerRepository } from '../../ports/customer.repository';

function createCustomerWithDriver(): { customer: Customer; driverId: string } {
  const customer = Customer.create({
    companyId: 'company-1',
    name: CustomerName.from('Juan Perez'),
    taxIdOrDocumentId: TaxIdOrDocumentId.from('DOC-0001'),
    contactInfo: ContactInfo.from({ email: 'juan@example.com', phone: '+525512345678' }),
    customerType: 'Individual',
  });
  const driverId = customer.registerAdditionalDriver('Maria Lopez').toString();
  return { customer, driverId };
}

function buildHandler(existingCustomer: Customer | null) {
  const customerRepository: CustomerRepository = {
    findById: jest.fn().mockResolvedValue(existingCustomer),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new ValidateAdditionalDriverLicenseHandler(
    customerRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, customerRepository, eventPublisher };
}

describe('ValidateAdditionalDriverLicenseHandler', () => {
  it('lanza CustomerNotFoundError si el customer no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        customerId: '018e5a00-0000-7000-8000-000000000000',
        companyId: 'company-1',
        driverId: 'driver-1',
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('INV-012: propaga AdditionalDriverMissingValidLicenseError sin licencia vigente', async () => {
    const { customer, driverId } = createCustomerWithDriver();
    const { handler } = buildHandler(customer);

    await expect(
      handler.execute({ customerId: customer.id.toString(), companyId: 'company-1', driverId }),
    ).rejects.toThrow(AdditionalDriverMissingValidLicenseError);
  });

  it('con licencia vigente, valida al driver, persiste y publica AdditionalDriverValidated.v1', async () => {
    const { customer, driverId } = createCustomerWithDriver();
    const licenseId = customer
      .uploadIdentityDocument({
        owner: { type: 'AdditionalDriver', id: driverId },
        documentType: 'DriversLicense',
        fileId: 'file-license',
        expiryDate: new Date('2030-01-01'),
      })
      .toString();
    customer.verifyIdentityDocument(licenseId);
    const { handler, customerRepository, eventPublisher } = buildHandler(customer);

    await handler.execute({ customerId: customer.id.toString(), companyId: 'company-1', driverId });

    expect(customer.allAdditionalDrivers[0].status).toBe('Validated');
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'AdditionalDriverValidated.v1' }),
    );
  });
});
