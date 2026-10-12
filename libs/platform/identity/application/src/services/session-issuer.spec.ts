import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { UserLookupResult } from '@platform/users/application';

import type { RefreshTokenHasher } from '../ports/refresh-token-hasher.port';
import type { SessionRepository } from '../ports/session.repository';
import type { TokenSigner } from '../ports/token-signer.port';
import { SessionIssuer } from './session-issuer';

const user: UserLookupResult = {
  userId: 'user-1',
  companyId: 'company-1',
  passwordHash: 'stored-hash',
  status: 'Active',
  roles: ['role-1'],
  mfaEnabled: false,
};

function buildIssuer() {
  const sessionRepository: SessionRepository = {
    findById: jest.fn(),
    findByRefreshTokenHash: jest.fn(),
    findActiveForUser: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const refreshTokenHasher: RefreshTokenHasher = {
    generate: jest
      .fn()
      .mockReturnValue({ plaintext: 'plain-refresh-token', hash: 'hashed-refresh-token' }),
    hash: jest.fn(),
  };
  const tokenSigner: TokenSigner = {
    signAccessToken: jest.fn().mockReturnValue('signed-access-token'),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const issuer = new SessionIssuer(
    sessionRepository,
    refreshTokenHasher,
    tokenSigner,
    unitOfWork,
    eventPublisher,
  );

  return { issuer, sessionRepository, unitOfWork, eventPublisher };
}

describe('SessionIssuer', () => {
  it('issueForUser() crea una Session Active, la persiste dentro de UnitOfWork.run(companyId) y devuelve los tokens', async () => {
    const { issuer, sessionRepository, unitOfWork, eventPublisher } = buildIssuer();

    const result = await issuer.issueForUser(user, { userAgent: 'jest' });

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toBe('plain-refresh-token');
    expect(result.sessionId).toEqual(expect.any(String));
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'SessionCreated.v1', companyId: 'company-1' }),
    );
  });
});
