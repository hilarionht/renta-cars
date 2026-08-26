import { EntityId, type DomainEventPublisher, type UnitOfWork } from '@platform/shared-kernel';
import {
  InvalidMfaCodeError,
  MfaChallengeNotFoundError,
  MfaLoginChallenge,
} from '@platform/identity/domain';
import type {
  MfaSecretCipher,
  MfaTotpPort,
  UserLookupPort,
  UserLookupResult,
} from '@platform/users/application';

import type { MfaLoginChallengeRepository } from '../../ports/mfa-login-challenge.repository';
import type { IssuedSession, SessionIssuer } from '../../services/session-issuer';
import { VerifyMfaLoginHandler } from './verify-mfa-login.handler';
import type { VerifyMfaLoginCommand } from './verify-mfa-login.command';

const inFiveMinutes = new Date(Date.now() + 5 * 60 * 1000);

function issueChallenge(): MfaLoginChallenge {
  return MfaLoginChallenge.request({
    companyId: 'company-1',
    userId: 'user-1',
    expiresAt: inFiveMinutes,
    maxAttempts: 5,
  });
}

const mfaUser: UserLookupResult = {
  userId: 'user-1',
  companyId: 'company-1',
  passwordHash: 'stored-hash',
  status: 'Active',
  roles: ['role-1'],
  mfaEnabled: true,
  mfaSecretEncrypted: 'encrypted-secret',
};

const issuedSession: IssuedSession = {
  accessToken: 'signed-access-token',
  refreshToken: 'plain-refresh-token',
  sessionId: 'session-1',
};

function buildHandler(overrides?: {
  challenge?: MfaLoginChallenge | null;
  foundUser?: UserLookupResult | null;
  codeIsValid?: boolean;
}) {
  const challenge = overrides && 'challenge' in overrides ? overrides.challenge : issueChallenge();
  const foundUser = overrides && 'foundUser' in overrides ? overrides.foundUser : mfaUser;

  const mfaLoginChallengeRepository: MfaLoginChallengeRepository = {
    findById: jest.fn().mockResolvedValue(challenge),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const userLookup: UserLookupPort = {
    findByCompanyAndEmail: jest.fn(),
    findById: jest.fn().mockResolvedValue(foundUser),
  };
  const secretCipher: MfaSecretCipher = {
    encrypt: jest.fn(),
    decrypt: jest.fn().mockReturnValue('decrypted-secret'),
  };
  const totp: MfaTotpPort = {
    generateSecret: jest.fn(),
    verifyCode: jest.fn().mockResolvedValue(overrides?.codeIsValid ?? true),
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

  const handler = new VerifyMfaLoginHandler(
    mfaLoginChallengeRepository,
    userLookup,
    secretCipher,
    totp,
    sessionIssuer,
    unitOfWork,
    eventPublisher,
  );

  return {
    handler,
    mfaLoginChallengeRepository,
    userLookup,
    totp,
    sessionIssuer,
    unitOfWork,
    eventPublisher,
  };
}

const baseCommand: VerifyMfaLoginCommand = {
  mfaChallengeId: EntityId.generate<'MfaLoginChallenge'>().toString(),
  companyId: 'company-1',
  code: '123456',
};

describe('VerifyMfaLoginHandler', () => {
  it('lanza MfaChallengeNotFoundError si no hay challenge para el id presentado', async () => {
    const { handler } = buildHandler({ challenge: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(MfaChallengeNotFoundError);
  });

  it('lanza MfaChallengeNotFoundError si el User ya no tiene MFA habilitado', async () => {
    const { handler } = buildHandler({ foundUser: { ...mfaUser, mfaEnabled: false } });

    await expect(handler.execute(baseCommand)).rejects.toThrow(MfaChallengeNotFoundError);
  });

  it('codigo invalido: persiste el intento, publica MfaVerificationFailed.v1 y lanza InvalidMfaCodeError', async () => {
    const { handler, mfaLoginChallengeRepository, eventPublisher } = buildHandler({
      codeIsValid: false,
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidMfaCodeError);

    expect(mfaLoginChallengeRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'MfaVerificationFailed.v1' }),
    );
  });

  it('challenge expirado: lanza MfaChallengeNotFoundError sin publicar MfaVerificationFailed.v1', async () => {
    const expired = MfaLoginChallenge.request({
      companyId: 'company-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1),
      maxAttempts: 5,
    });
    const { handler, eventPublisher } = buildHandler({ challenge: expired });

    await expect(handler.execute(baseCommand)).rejects.toThrow(MfaChallengeNotFoundError);
    expect(eventPublisher.publish).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'MfaVerificationFailed.v1' }),
    );
  });

  it('reintentar un challenge ya Verified lanza MfaChallengeNotFoundError sin volver a persistir ni verificar el codigo (encontrado via smoke test real)', async () => {
    const alreadyVerified = issueChallenge();
    alreadyVerified.attemptVerification(true, new Date());
    const { handler, mfaLoginChallengeRepository, totp } = buildHandler({
      challenge: alreadyVerified,
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow(MfaChallengeNotFoundError);
    expect(totp.verifyCode).not.toHaveBeenCalled();
    expect(mfaLoginChallengeRepository.save).not.toHaveBeenCalled();
  });

  it('codigo valido: persiste el challenge Verified y delega en SessionIssuer', async () => {
    const { handler, mfaLoginChallengeRepository, sessionIssuer } = buildHandler();

    const result = await handler.execute(baseCommand);

    expect(result).toEqual(issuedSession);
    expect(mfaLoginChallengeRepository.save).toHaveBeenCalledTimes(1);
    expect(sessionIssuer.issueForUser).toHaveBeenCalledWith(mfaUser, {});
  });
});
