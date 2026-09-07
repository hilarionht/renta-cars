import {
  Email,
  EntityId,
  type DomainEventPublisher,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  EncryptedMfaSecret,
  InvalidMfaCodeError,
  PasswordHash,
  PersonName,
  User,
  UserNotFoundError,
} from '@platform/users/domain';

import type { MfaSecretCipher } from '../../ports/mfa-secret-cipher.port';
import type { MfaTotpPort } from '../../ports/mfa-totp.port';
import type { UserRepository } from '../../ports/user.repository';
import { DisableMfaHandler } from './disable-mfa.handler';
import type { DisableMfaCommand } from './disable-mfa.command';

function buildUserWithMfaEnabled(companyId = 'company-1'): User {
  const user = User.create({
    companyId,
    email: Email.from('owner@example.com'),
    passwordHash: PasswordHash.fromHash('stored-hash'),
    name: PersonName.from('Owner'),
    roles: [],
  });
  user.enableMfa(EncryptedMfaSecret.fromEncrypted('encrypted-secret'));
  return user;
}

function buildHandler(overrides?: { existingUser?: User | null; codeIsValid?: boolean }) {
  const existingUser =
    overrides && 'existingUser' in overrides ? overrides.existingUser : buildUserWithMfaEnabled();
  const userRepository: UserRepository = {
    findById: jest.fn().mockResolvedValue(existingUser),
    findByCompanyAndEmail: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const totp: MfaTotpPort = {
    generateSecret: jest.fn(),
    verifyCode: jest.fn().mockResolvedValue(overrides?.codeIsValid ?? true),
  };
  const secretCipher: MfaSecretCipher = {
    encrypt: jest.fn(),
    decrypt: jest.fn().mockReturnValue('decrypted-secret'),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new DisableMfaHandler(
    userRepository,
    totp,
    secretCipher,
    unitOfWork,
    eventPublisher,
  );

  return { handler, userRepository };
}

const baseCommand: DisableMfaCommand = {
  userId: EntityId.generate<'User'>().toString(),
  companyId: 'company-1',
  code: '123456',
};

describe('DisableMfaHandler', () => {
  it('lanza UserNotFoundError si el usuario no existe', async () => {
    const { handler } = buildHandler({ existingUser: null });

    await expect(handler.execute(baseCommand)).rejects.toThrow(UserNotFoundError);
  });

  it('lanza UserNotFoundError si el usuario pertenece a otra company', async () => {
    const { handler } = buildHandler({ existingUser: buildUserWithMfaEnabled('company-2') });

    await expect(handler.execute(baseCommand)).rejects.toThrow(UserNotFoundError);
  });

  it('es idempotente si el usuario ya no tiene MFA habilitado (no exige codigo, no persiste)', async () => {
    const plainUser = User.create({
      companyId: 'company-1',
      email: Email.from('owner@example.com'),
      passwordHash: PasswordHash.fromHash('stored-hash'),
      name: PersonName.from('Owner'),
      roles: [],
    });
    const { handler, userRepository } = buildHandler({ existingUser: plainUser });

    await handler.execute(baseCommand);

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('lanza InvalidMfaCodeError si el codigo TOTP actual no verifica', async () => {
    const { handler } = buildHandler({ codeIsValid: false });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidMfaCodeError);
  });

  it('en exito: deshabilita MFA en el User y lo persiste', async () => {
    const { handler, userRepository } = buildHandler();

    await handler.execute(baseCommand);

    expect(userRepository.save).toHaveBeenCalledTimes(1);
    const saved = (userRepository.save as jest.Mock).mock.calls[0][0] as User;
    expect(saved.mfaEnabled).toBe(false);
  });
});
