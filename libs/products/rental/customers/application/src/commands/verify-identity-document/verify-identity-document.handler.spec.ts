import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  ContactInfo,
  Customer,
  CustomerName,
  CustomerNotFoundError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';

import { VerifyIdentityDocumentHandler } from './verify-identity-document.handler';
import type { CustomerRepository } from '../../ports/customer.repository';

function createCustomerWithDocument(): { customer: Customer; documentId: string } {
  const customer = Customer.create({
    companyId: 'company-1',
    name: CustomerName.from('Juan Perez'),
    taxIdOrDocumentId: TaxIdOrDocumentId.from('DOC-0001'),
    contactInfo: ContactInfo.from({ email: 'juan@example.com', phone: '+525512345678' }),
    customerType: 'Individual',
  });
  const documentId = customer
    .uploadIdentityDocument({
      owner: { type: 'Customer', id: customer.id.toString() },
      documentType: 'NationalId',
      fileId: 'file-1',
      expiryDate: new Date('2030-01-01'),
    })
    .toString();
  return { customer, documentId };
}

function buildHandler(existingCustomer: Customer | null) {
  const customerRepository: CustomerRepository = {
    findById: jest.fn().mockResolvedValue(existingCustomer),
    findByCompanyIdAndPhone: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new VerifyIdentityDocumentHandler(customerRepository, unitOfWork, eventPublisher);

  return { handler, customerRepository, eventPublisher };
}

describe('VerifyIdentityDocumentHandler', () => {
  it('lanza CustomerNotFoundError si el customer no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        customerId: '018e5a00-0000-7000-8000-000000000000',
        companyId: 'company-1',
        documentId: 'doc-1',
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('verifica el documento, persiste y publica CustomerDocumentValidated.v1', async () => {
    const { customer, documentId } = createCustomerWithDocument();
    const { handler, customerRepository, eventPublisher } = buildHandler(customer);

    await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      documentId,
    });

    expect(customer.status).toBe('Active');
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'CustomerDocumentValidated.v1' }),
    );
  });

  // Regresion del bug real docs/persistence/10-DECISIONES.md #56: verificar un documento ya
  // Verified es idempotente y no bumpea version - save() debe saltearse por completo.
  it('segunda llamada sobre un documento ya Verified es idempotente: no llama a save()', async () => {
    const { customer, documentId } = createCustomerWithDocument();
    customer.verifyIdentityDocument(documentId);
    const { handler, customerRepository, eventPublisher } = buildHandler(customer);

    await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      documentId,
    });

    expect(customerRepository.save).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });
});
