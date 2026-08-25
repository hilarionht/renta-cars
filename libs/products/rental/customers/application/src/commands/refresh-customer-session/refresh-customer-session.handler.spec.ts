import { EntityId, type DomainEventPublisher, type UnitOfWork } from '@platform/shared-kernel';
import {
  ContactInfo,
  Customer,
  CustomerDeviceContext,
  CustomerName,
  CustomerRefreshTokenHash,
  CustomerRefreshTokenReusedError,
  CustomerSession,
  InvalidCustomerRefreshTokenError,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';
import type { TokenSigner } from '@platform/identity/application';

import type { CustomerRefreshTokenHasher } from '../../ports/customer-refresh-token-hasher.port';
import type { CustomerSessionRepository } from '../../ports/customer-session.repository';
import type { CustomerRepository } from '../../ports/customer.repository';
import { RefreshCustomerSessionHandler } from './refresh-customer-session.handler';
import type { RefreshCustomerSessionCommand } from './refresh-customer-session.command';

const deviceContext = CustomerDeviceContext.from({ userAgent: 'jest' });
const customerId = EntityId.generate<'Customer'>().toString();

function issueSession(): CustomerSession {
  return CustomerSession.issue({
    customerId,
    companyId: 'company-1',
    refreshTokenHash: CustomerRefreshTokenHash.fromHash('stored-hash'),
    deviceContext,
  });
}

function createCustomer(): Customer {
  return Customer.create({
    companyId: 'company-1',
    name: CustomerName.from('Juan Perez'),
    taxIdOrDocumentId: TaxIdOrDocumentId.from('DOC-0001'),
    contactInfo: ContactInfo.from({ email: 'juan@example.com', phone: '+525512345678' }),
    customerType: 'Individual',
  });
}

function buildHandler(overrides?: {
  matchedSession?: CustomerSession | null;
  activeSessionsForCustomer?: CustomerSession[];
  customer?: Customer | null;
}) {
  const matchedSession =
    overrides && 'matchedSession' in overrides ? overrides.matchedSession : issueSession();
  const customer = overrides && 'customer' in overrides ? overrides.customer : createCustomer();

  const customerSessionRepository: CustomerSessionRepository = {
    findById: jest.fn(),
    findByRefreshTokenHash: jest.fn().mockResolvedValue(matchedSession),
    findActiveForCustomer: jest.fn().mockResolvedValue(overrides?.activeSessionsForCustomer ?? []),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const refreshTokenHasher: CustomerRefreshTokenHasher = {
    generate: jest.fn().mockReturnValue({ plaintext: 'new-plain-token', hash: 'new-hash' }),
    hash: jest.fn().mockReturnValue('presented-hash'),
  };
  const tokenSigner: TokenSigner = {
    signAccessToken: jest.fn().mockReturnValue('signed-access-token'),
  };
  const customerRepository: CustomerRepository = {
    findById: jest.fn().mockResolvedValue(customer),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new RefreshCustomerSessionHandler(
    customerSessionRepository,
    refreshTokenHasher,
    tokenSigner,
    customerRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, customerSessionRepository, customerRepository, unitOfWork, eventPublisher };
}

const baseCommand: RefreshCustomerSessionCommand = { refreshToken: 'presented-plain-token' };

describe('RefreshCustomerSessionHandler', () => {
  it('lanza InvalidCustomerRefreshTokenError si ninguna CustomerSession matchea el hash presentado', async () => {
    const { handler } = buildHandler({ matchedSession: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidCustomerRefreshTokenError);
  });

  it('en exito: rota la CustomerSession (Active -> Rotated + una nueva Active), persiste ambas dentro de UnitOfWork.run(companyId) y devuelve tokens nuevos con actorType Customer', async () => {
    const { handler, customerSessionRepository, unitOfWork, eventPublisher, customerRepository } =
      buildHandler();

    const result = await handler.execute(baseCommand);

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toBe('new-plain-token');
    expect(customerSessionRepository.save).toHaveBeenCalledTimes(2);
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(eventPublisher.publish).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'CustomerSessionTheftDetected.v1' }),
    );
    const findByIdArg = (customerRepository.findById as jest.Mock).mock.calls[0][0] as {
      toString(): string;
    };
    expect(findByIdArg.toString()).toBe(customerId);
  });

  it('reusar un refresh token de una CustomerSession ya Rotated dispara robo: revoca TODAS las sesiones activas del customer, publica CustomerSessionTheftDetected.v1 y lanza CustomerRefreshTokenReusedError (nunca revela el robo al cliente)', async () => {
    const alreadyRotated = issueSession();
    alreadyRotated.markRotated();
    const otherActiveSession = issueSession();

    const { handler, customerSessionRepository, unitOfWork, eventPublisher } = buildHandler({
      matchedSession: alreadyRotated,
      activeSessionsForCustomer: [otherActiveSession],
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow(CustomerRefreshTokenReusedError);

    expect(otherActiveSession.status).toBe('Revoked');
    expect(customerSessionRepository.save).toHaveBeenCalledTimes(1);
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'CustomerSessionTheftDetected.v1',
        payload: expect.objectContaining({ customerId }),
      }),
    );
  });

  it('lanza InvalidCustomerRefreshTokenError si el customer ya no existe al re-armar los claims del access_token nuevo', async () => {
    const { handler } = buildHandler({ customer: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidCustomerRefreshTokenError);
  });
});
