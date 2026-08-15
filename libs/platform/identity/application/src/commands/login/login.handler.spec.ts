import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { InvalidCredentialsError, UserDisabledError } from '@platform/identity/domain';
import type { UserLookupPort, UserLookupResult, PasswordHasher } from '@platform/users/application';

import type { RefreshTokenHasher } from '../../ports/refresh-token-hasher.port';
import type { SessionRepository } from '../../ports/session.repository';
import type { TokenSigner } from '../../ports/token-signer.port';
import { LoginHandler } from './login.handler';
import type { LoginCommand } from './login.command';

const activeUser: UserLookupResult = {
  userId: 'user-1',
  companyId: 'company-1',
  passwordHash: 'stored-hash',
  status: 'Active',
  roles: ['role-1'],
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

  const handler = new LoginHandler(
    userLookup,
    passwordHasher,
    sessionRepository,
    refreshTokenHasher,
    tokenSigner,
    unitOfWork,
    eventPublisher,
  );

  return { handler, userLookup, passwordHasher, sessionRepository, unitOfWork, eventPublisher };
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

  it('en exito: crea una Session Active, la persiste dentro de UnitOfWork.run(companyId) y devuelve los tokens', async () => {
    const { handler, sessionRepository, unitOfWork, eventPublisher } = buildHandler();

    const result = await handler.execute(baseCommand);

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toBe('plain-refresh-token');
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'SessionCreated.v1', companyId: 'company-1' }),
    );
  });
});
