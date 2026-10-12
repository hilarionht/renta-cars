import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  DeviceContext,
  InvalidRefreshTokenError,
  RefreshTokenHash,
  RefreshTokenReusedError,
  Session,
} from '@platform/identity/domain';
import type { UserLookupPort, UserLookupResult } from '@platform/users/application';

import type { RefreshTokenHasher } from '../../ports/refresh-token-hasher.port';
import type { SessionRepository } from '../../ports/session.repository';
import type { TokenSigner } from '../../ports/token-signer.port';
import { RefreshSessionHandler } from './refresh-session.handler';
import type { RefreshSessionCommand } from './refresh-session.command';

const deviceContext = DeviceContext.from({ userAgent: 'jest' });

function issueSession(): Session {
  return Session.issue({
    userId: 'user-1',
    companyId: 'company-1',
    refreshTokenHash: RefreshTokenHash.fromHash('stored-hash'),
    deviceContext,
  });
}

const matchingUser: UserLookupResult = {
  userId: 'user-1',
  companyId: 'company-1',
  status: 'Active',
  passwordHash: 'irrelevant',
  roles: ['role-1'],
  mfaEnabled: false,
};

function buildHandler(overrides?: {
  matchedSession?: Session | null;
  activeSessionsForUser?: Session[];
}) {
  const matchedSession =
    overrides && 'matchedSession' in overrides ? overrides.matchedSession : issueSession();
  const sessionRepository: SessionRepository = {
    findById: jest.fn(),
    findByRefreshTokenHash: jest.fn().mockResolvedValue(matchedSession),
    findActiveForUser: jest.fn().mockResolvedValue(overrides?.activeSessionsForUser ?? []),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const refreshTokenHasher: RefreshTokenHasher = {
    generate: jest.fn().mockReturnValue({ plaintext: 'new-plain-token', hash: 'new-hash' }),
    hash: jest.fn().mockReturnValue('presented-hash'),
  };
  const tokenSigner: TokenSigner = {
    signAccessToken: jest.fn().mockReturnValue('signed-access-token'),
  };
  const userLookup: UserLookupPort = {
    findByCompanyAndEmail: jest.fn(),
    findById: jest.fn().mockResolvedValue(matchingUser),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new RefreshSessionHandler(
    sessionRepository,
    refreshTokenHasher,
    tokenSigner,
    userLookup,
    unitOfWork,
    eventPublisher,
  );

  return { handler, sessionRepository, userLookup, unitOfWork, eventPublisher };
}

const baseCommand: RefreshSessionCommand = { refreshToken: 'presented-plain-token' };

describe('RefreshSessionHandler', () => {
  it('lanza InvalidRefreshTokenError si ningun Session matchea el hash presentado', async () => {
    const { handler } = buildHandler({ matchedSession: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('en exito: rota la Session (Active -> Rotated + una nueva Active), persiste ambas dentro de UnitOfWork.run(companyId) y devuelve tokens nuevos', async () => {
    const { handler, sessionRepository, unitOfWork, eventPublisher } = buildHandler();

    const result = await handler.execute(baseCommand);

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toBe('new-plain-token');
    expect(sessionRepository.save).toHaveBeenCalledTimes(2);
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(eventPublisher.publish).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'SessionTheftDetected.v1' }),
    );
  });

  it('reusar un refresh token de una Session ya Rotated dispara robo: revoca TODAS las sesiones activas del usuario, publica SessionTheftDetected.v1 y lanza RefreshTokenReusedError (nunca revela el robo al cliente)', async () => {
    const alreadyRotated = issueSession();
    alreadyRotated.markRotated();
    const otherActiveSession = issueSession();

    const { handler, sessionRepository, unitOfWork, eventPublisher } = buildHandler({
      matchedSession: alreadyRotated,
      activeSessionsForUser: [otherActiveSession],
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow(RefreshTokenReusedError);

    expect(otherActiveSession.status).toBe('Revoked');
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'SessionTheftDetected.v1',
        payload: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('lanza InvalidRefreshTokenError si el usuario ya no existe al re-armar los claims del access_token nuevo', async () => {
    const { handler, userLookup } = buildHandler();
    (userLookup.findById as jest.Mock).mockResolvedValue(null);

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidRefreshTokenError);
  });
});
