import { Email, type UnitOfWork } from '@platform/shared-kernel';
import { PasswordHash, PersonName, User } from '@platform/users/domain';
import type { SendNotificationHandler } from '@platform/notifications/application';

import type { PasswordResetChallengeRepository } from '../../ports/password-reset-challenge.repository';
import type { PasswordResetTokenHasher } from '../../ports/password-reset-token-hasher.port';
import type { UserRepository } from '../../ports/user.repository';
import { RequestPasswordResetHandler } from './request-password-reset.handler';
import type { RequestPasswordResetCommand } from './request-password-reset.command';

function buildUser(): User {
  return User.create({
    companyId: 'company-1',
    email: Email.from('owner@example.com'),
    passwordHash: PasswordHash.fromHash('stored-hash'),
    name: PersonName.from('Owner'),
    roles: [],
  });
}

function buildHandler(overrides?: { existingUser?: User | null }) {
  const existingUser =
    overrides && 'existingUser' in overrides ? overrides.existingUser : buildUser();
  const userRepository: UserRepository = {
    findById: jest.fn(),
    findByCompanyAndEmail: jest.fn().mockResolvedValue(existingUser),
    save: jest.fn(),
  };
  const challengeRepository: PasswordResetChallengeRepository = {
    findByTokenHash: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const tokenHasher: PasswordResetTokenHasher = {
    generate: jest.fn().mockReturnValue({ plaintext: 'plain-token', hash: 'hashed-token' }),
    hash: jest.fn(),
  };
  const sendNotification = {
    execute: jest.fn().mockResolvedValue(undefined),
  } as unknown as SendNotificationHandler;
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };

  const handler = new RequestPasswordResetHandler(
    userRepository,
    challengeRepository,
    tokenHasher,
    sendNotification,
    unitOfWork,
  );

  return { handler, challengeRepository, sendNotification, unitOfWork };
}

const baseCommand: RequestPasswordResetCommand = {
  companyId: 'company-1',
  email: 'owner@example.com',
};

describe('RequestPasswordResetHandler', () => {
  it('email desconocido: no-op silencioso, sin persistir ni notificar (anti-enumeracion)', async () => {
    const { handler, challengeRepository, sendNotification } = buildHandler({
      existingUser: null,
    });

    await handler.execute(baseCommand);

    expect(challengeRepository.save).not.toHaveBeenCalled();
    expect(sendNotification.execute).not.toHaveBeenCalled();
  });

  it('en exito: persiste el challenge y envia la notificacion por Email, sin fallback', async () => {
    const { handler, challengeRepository, sendNotification, unitOfWork } = buildHandler();

    await handler.execute(baseCommand);

    expect(challengeRepository.save).toHaveBeenCalledTimes(1);
    expect(unitOfWork.run).toHaveBeenCalledWith(expect.any(Function), 'company-1');
    expect(sendNotification.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        kind: 'SecurityCode',
        recipient: { email: 'owner@example.com' },
        templateId: 'user-password-reset',
        templateParams: { token: 'plain-token' },
        requireExactChannel: 'Email',
      }),
    );
  });
});
