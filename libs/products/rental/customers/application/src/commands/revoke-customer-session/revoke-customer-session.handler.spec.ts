import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  CustomerDeviceContext,
  CustomerRefreshTokenHash,
  CustomerSession,
} from '@rental/customers/domain';

import type { CustomerRefreshTokenHasher } from '../../ports/customer-refresh-token-hasher.port';
import type { CustomerSessionRepository } from '../../ports/customer-session.repository';
import { RevokeCustomerSessionHandler } from './revoke-customer-session.handler';
import type { RevokeCustomerSessionCommand } from './revoke-customer-session.command';

const deviceContext = CustomerDeviceContext.from({ userAgent: 'jest' });

function issueSession(): CustomerSession {
  return CustomerSession.issue({
    customerId: 'customer-1',
    companyId: 'company-1',
    refreshTokenHash: CustomerRefreshTokenHash.fromHash('stored-hash'),
    deviceContext,
  });
}

function buildHandler(matchedSession: CustomerSession | null) {
  const customerSessionRepository: CustomerSessionRepository = {
    findById: jest.fn(),
    findByRefreshTokenHash: jest.fn().mockResolvedValue(matchedSession),
    findActiveForCustomer: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const refreshTokenHasher: CustomerRefreshTokenHasher = {
    generate: jest.fn(),
    hash: jest.fn().mockReturnValue('presented-hash'),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new RevokeCustomerSessionHandler(
    customerSessionRepository,
    refreshTokenHasher,
    unitOfWork,
    eventPublisher,
  );

  return { handler, customerSessionRepository, unitOfWork, eventPublisher };
}

const baseCommand: RevokeCustomerSessionCommand = {
  refreshToken: 'presented-plain-token',
  reason: 'logout',
};

describe('RevokeCustomerSessionHandler', () => {
  it('es un no-op silencioso si ninguna CustomerSession matchea el hash presentado', async () => {
    const { handler, customerSessionRepository } = buildHandler(null);

    await expect(handler.execute(baseCommand)).resolves.toBeUndefined();
    expect(customerSessionRepository.save).not.toHaveBeenCalled();
  });

  it('es un no-op silencioso si la CustomerSession matcheada ya no esta Active', async () => {
    const alreadyRevoked = issueSession();
    alreadyRevoked.revoke('previous_logout');
    const { handler, customerSessionRepository } = buildHandler(alreadyRevoked);

    await expect(handler.execute(baseCommand)).resolves.toBeUndefined();
    expect(customerSessionRepository.save).not.toHaveBeenCalled();
  });

  it('revoca la CustomerSession Active, la persiste dentro de UnitOfWork.run(companyId) y publica CustomerSessionRevoked.v1', async () => {
    const session = issueSession();
    const { handler, customerSessionRepository, unitOfWork, eventPublisher } =
      buildHandler(session);

    await handler.execute(baseCommand);

    expect(session.status).toBe('Revoked');
    expect(customerSessionRepository.save).toHaveBeenCalledWith(session, {});
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'CustomerSessionRevoked.v1' }),
    );
  });
});
