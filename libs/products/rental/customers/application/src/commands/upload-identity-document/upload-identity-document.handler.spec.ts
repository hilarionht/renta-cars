import type { UnitOfWork } from '@platform/shared-kernel';
import {
  AdditionalDriverNotFoundError,
  ContactInfo,
  Customer,
  CustomerName,
  CustomerNotFoundError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';

import { UploadIdentityDocumentHandler } from './upload-identity-document.handler';
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

  const handler = new UploadIdentityDocumentHandler(customerRepository, unitOfWork);

  return { handler, customerRepository };
}

describe('UploadIdentityDocumentHandler', () => {
  it('lanza CustomerNotFoundError si el customer no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        customerId: '018e5a00-0000-7000-8000-000000000000',
        companyId: 'company-1',
        documentType: 'NationalId',
        fileId: 'file-1',
        expiryDate: new Date('2030-01-01'),
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('sin additionalDriverId, el documento pertenece al propio Customer', async () => {
    const customer = createCustomer();
    const { handler, customerRepository } = buildHandler(customer);

    const documentId = await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      documentType: 'NationalId',
      fileId: 'file-1',
      expiryDate: new Date('2030-01-01'),
    });

    expect(documentId).toBeDefined();
    expect(customer.allIdentityDocuments[0].owner).toEqual({
      type: 'Customer',
      id: customer.id.toString(),
    });
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
  });

  it('con additionalDriverId inexistente, propaga AdditionalDriverNotFoundError', async () => {
    const customer = createCustomer();
    const { handler } = buildHandler(customer);

    await expect(
      handler.execute({
        customerId: customer.id.toString(),
        companyId: 'company-1',
        documentType: 'DriversLicense',
        fileId: 'file-license',
        expiryDate: new Date('2030-01-01'),
        additionalDriverId: 'driver-inexistente',
      }),
    ).rejects.toThrow(AdditionalDriverNotFoundError);
  });
});
