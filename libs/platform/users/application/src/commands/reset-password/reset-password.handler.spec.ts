import { Email, type DomainEventPublisher, type UnitOfWork } from '@platform/shared-kernel';
import {
  PasswordHash,
  PasswordResetChallenge,
  PasswordResetTokenHash,
  PasswordResetTokenInvalidError,
  PersonName,
  User,
} from '@platform/users/domain';

import type { PasswordHasher } from '../../ports/password-hasher.port';
import type { PasswordResetChallengeRepository } from '../../ports/password-reset-challenge.repository';
import type { PasswordResetTokenHasher } from '../../ports/password-reset-token-hasher.port';
import type { UserRepository } from '../../ports/user.repository';
import { ResetPasswordHandler } from './reset-password.handler';
import type { ResetPasswordCommand } from './reset-password.command';

const inThirtyMinutes = new Date(Date.now() + 30 * 60 * 1000);

function buildUser(): User {
  return User.create({
    companyId: 'company-1',
    email: Email.from('owner@example.com'),
    passwordHash: PasswordHash.fromHash('stored-hash'),
    name: PersonName.from('Owner'),
    roles: [],
  });
}

function issueChallenge(userId: string, overrides?: { expiresAt?: Date }): PasswordResetChallenge {
  return PasswordResetChallenge.request({
    companyId: 'company-1',
    userId,
    tokenHash: PasswordResetTokenHash.fromHash('stored-hash'),
    expiresAt: overrides?.expiresAt ?? inThirtyMinutes,
  });
}

function buildHandler(overrides?: {
  challenge?: PasswordResetChallenge | null;
  existingUser?: User | null;
}) {
  const existingUser =
    overrides && 'existingUser' in overrides ? overrides.existingUser : buildUser();
  const challenge =
    overrides && 'challenge' in overrides
      ? overrides.challenge
      : issueChallenge(existingUser ? existingUser.id.toString() : 'user-1');

  const challengeRepository: PasswordResetChallengeRepository = {
    findByTokenHash: jest.fn().mockResolvedValue(challenge),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const tokenHasher: PasswordResetTokenHasher = {
    generate: jest.fn(),
    hash: jest.fn().mockReturnValue('hashed-token'),
  };
  const userRepository: UserRepository = {
    findById: jest.fn().mockResolvedValue(existingUser),
    findByCompanyAndEmail: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const passwordHasher: PasswordHasher = {
    hash: jest.fn().mockResolvedValue('new-hashed-password'),
    verify: jest.fn(),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new ResetPasswordHandler(
    challengeRepository,
    tokenHasher,
    userRepository,
    passwordHasher,
    unitOfWork,
    eventPublisher,
  );

  return { handler, challengeRepository, userRepository, eventPublisher };
}

const baseCommand: ResetPasswordCommand = {
  token: 'plain-token',
  newPassword: 'Sup3rSecret!123',
};

describe('ResetPasswordHandler', () => {
  it('token no encontrado: lanza PasswordResetTokenInvalidError sin persistir ni publicar', async () => {
    const { handler, challengeRepository, eventPublisher } = buildHandler({ challenge: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(PasswordResetTokenInvalidError);
    expect(challengeRepository.save).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('token ya Verified (replay): publica PasswordResetTokenReplayed.v1, sin guardar, y lanza el error', async () => {
    const alreadyVerified = issueChallenge('user-1');
    alreadyVerified.attemptConsume(new Date());
    const { handler, challengeRepository, eventPublisher } = buildHandler({
      challenge: alreadyVerified,
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow(PasswordResetTokenInvalidError);
    expect(challengeRepository.save).not.toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'PasswordResetTokenReplayed.v1' }),
    );
  });

  it('token expirado por tiempo (primer toque): persiste la transicion a Expired, sin evento de replay', async () => {
    const expired = issueChallenge('user-1', { expiresAt: new Date(Date.now() - 1) });
    const { handler, challengeRepository, eventPublisher } = buildHandler({ challenge: expired });

    await expect(handler.execute(baseCommand)).rejects.toThrow(PasswordResetTokenInvalidError);
    expect(challengeRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'PasswordResetTokenReplayed.v1' }),
    );
  });

  it('en exito: cambia la contraseña del User y persiste challenge+user en una unica transaccion', async () => {
    const { handler, challengeRepository, userRepository } = buildHandler();

    await handler.execute(baseCommand);

    expect(challengeRepository.save).toHaveBeenCalledTimes(1);
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    const savedUser = (userRepository.save as jest.Mock).mock.calls[0][0] as User;
    expect(savedUser.passwordHash.toString()).toBe('new-hashed-password');
  });
});
