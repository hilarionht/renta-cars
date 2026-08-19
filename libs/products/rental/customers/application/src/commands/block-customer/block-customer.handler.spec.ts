import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  ContactInfo,
  Customer,
  CustomerName,
  CustomerNotFoundError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';

import { BlockCustomerHandler } from './block-customer.handler';
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

  const handler = new BlockCustomerHandler(customerRepository, unitOfWork, eventPublisher);

  return { handler, customerRepository, eventPublisher };
}

describe('BlockCustomerHandler', () => {
  it('lanza CustomerNotFoundError si el customer no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        customerId: '018e5a00-0000-7000-8000-000000000000',
        companyId: 'company-1',
        reason: 'fraude',
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('bloquea al customer, persiste y publica CustomerBlocked.v1', async () => {
    const customer = createCustomer();
    const { handler, customerRepository, eventPublisher } = buildHandler(customer);

    await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      reason: 'fraude sospechoso',
    });

    expect(customer.blockStatus).toBe('Blocked');
    expect(customer.blockReason).toBe('fraude sospechoso');
    expect(customerRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'CustomerBlocked.v1' }),
    );
  });

  // Regresion del bug real documentado en docs/persistence/10-DECISIONES.md #56: block()
  // es idempotente y no bumpea version en un segundo llamado sobre un customer ya Blocked -
  // llamar a save() en ese caso lanzaria un ConcurrentModificationError espurio
  // (updateMany con version-1 nunca matchea si version no cambio). El handler debe saltear
  // la persistencia por completo cuando la mutacion fue un no-op.
  it('segunda llamada sobre un customer ya Blocked es idempotente: no llama a save() ni publica evento', async () => {
    const customer = createCustomer();
    customer.block('primera razon');
    const { handler, customerRepository, eventPublisher } = buildHandler(customer);

    await handler.execute({
      customerId: customer.id.toString(),
      companyId: 'company-1',
      reason: 'segunda razon',
    });

    expect(customerRepository.save).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });
});
