import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { InvalidCredentialsError, UserDisabledError } from '@platform/identity/domain';
import type { UserLookupPort, UserLookupResult, PasswordHasher } from '@platform/users/application';

import type { MfaLoginChallengeRepository } from '../../ports/mfa-login-challenge.repository';
import type { IssuedSession, SessionIssuer } from '../../services/session-issuer';
import { LoginHandler } from './login.handler';
import type { LoginCommand } from './login.command';

const activeUser: UserLookupResult = {
  userId: 'user-1',
  companyId: 'company-1',
  passwordHash: 'stored-hash',
  status: 'Active',
  roles: ['role-1'],
  mfaEnabled: false,
};

const issuedSession: IssuedSession = {
  accessToken: 'signed-access-token',
  refreshToken: 'plain-refresh-token',
  sessionId: 'session-1',
};

function buildHandler(overrides?: {
  foundUser?: UserLookupResult | null;
  passwordMatches?: boolean;
}) {
  const foundUser = overrides && 'foundUser' in overrides ? overrides.foundUser : activeUser;
  const userLookup: UserLookupPort = {
    findByCompanyAndEmail: jest.fn().mockResolvedValue(foundUser),
    findById: jest.fn(),
  };
  const passwordHasher: PasswordHasher = {
    hash: jest.fn(),
    verify: jest.fn().mockResolvedValue(overrides?.passwordMatches ?? true),
  };
  const mfaLoginChallengeRepository: MfaLoginChallengeRepository = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const sessionIssuer = {
    issueForUser: jest.fn().mockResolvedValue(issuedSession),
  } as unknown as SessionIssuer;
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new LoginHandler(
    userLookup,
    passwordHasher,
    mfaLoginChallengeRepository,
    sessionIssuer,
    unitOfWork,
    eventPublisher,
  );

  return {
    handler,
    userLookup,
    mfaLoginChallengeRepository,
    sessionIssuer,
    unitOfWork,
    eventPublisher,
  };
}

const baseCommand: LoginCommand = {
  companyId: 'company-1',
  email: 'operador@example.com',
  password: 'Sup3rSecret!123',
};

describe('LoginHandler', () => {
  it('lanza InvalidCredentialsError y publica LoginFailed.v1 (unknown_email) si el email no existe', async () => {
    const { handler, unitOfWork, eventPublisher } = buildHandler({ foundUser: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidCredentialsError);

    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'LoginFailed.v1',
        payload: expect.objectContaining({ reason: 'unknown_email' }),
      }),
    );
  });

  it('lanza UserDisabledError y publica LoginFailed.v1 (user_disabled) si el usuario esta Disabled', async () => {
    const { handler, eventPublisher } = buildHandler({
      foundUser: { ...activeUser, status: 'Disabled' },
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow(UserDisabledError);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ payload: expect.objectContaining({ reason: 'user_disabled' }) }),
    );
  });

  it('lanza InvalidCredentialsError y publica LoginFailed.v1 (invalid_password) si la contrasena no coincide', async () => {
    const { handler, eventPublisher } = buildHandler({ passwordMatches: false });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidCredentialsError);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ payload: expect.objectContaining({ reason: 'invalid_password' }) }),
    );
  });

  it('en exito sin MFA: delega en SessionIssuer y devuelve status authenticated', async () => {
    const { handler, sessionIssuer } = buildHandler();

    const result = await handler.execute(baseCommand);

    expect(result).toEqual({ status: 'authenticated', ...issuedSession });
    expect(sessionIssuer.issueForUser).toHaveBeenCalledWith(activeUser, {
      userAgent: undefined,
      ipAddress: undefined,
    });
  });

  it('con MFA habilitado: crea un MfaLoginChallenge, lo persiste y devuelve status mfa_required sin emitir tokens', async () => {
    const { handler, mfaLoginChallengeRepository, sessionIssuer, unitOfWork } = buildHandler({
      foundUser: { ...activeUser, mfaEnabled: true },
    });

    const result = await handler.execute(baseCommand);

    expect(result.status).toBe('mfa_required');
    if (result.status !== 'mfa_required') {
      throw new Error('expected mfa_required');
    }
    expect(result.mfaChallengeId).toEqual(expect.any(String));
    expect(mfaLoginChallengeRepository.save).toHaveBeenCalledTimes(1);
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(sessionIssuer.issueForUser).not.toHaveBeenCalled();
  });
});
