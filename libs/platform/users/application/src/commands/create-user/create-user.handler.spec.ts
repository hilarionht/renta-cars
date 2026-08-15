import {
  Email,
  type CompanyExistsPort,
  type DomainEventPublisher,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  CompanyNotFoundError,
  DuplicateEmailError,
  InvalidRoleAssignmentError,
  PasswordHash,
  PersonName,
  User,
} from '@platform/users/domain';
import type { RoleLookupPort } from '@platform/roles-permissions/application';

import type { PasswordHasher } from '../../ports/password-hasher.port';
import type { UserRepository } from '../../ports/user.repository';
import { CreateUserHandler } from './create-user.handler';
import type { CreateUserCommand } from './create-user.command';

function buildHandler(overrides?: {
  existingUser?: User | null;
  companyExists?: boolean;
  roleValid?: boolean;
}) {
  const savedUsers: User[] = [];
  const userRepository: UserRepository = {
    findById: jest.fn().mockResolvedValue(null),
    findByCompanyAndEmail: jest.fn().mockResolvedValue(overrides?.existingUser ?? null),
    save: jest.fn((user: User) => {
      savedUsers.push(user);
      return Promise.resolve();
    }),
  };
  const passwordHasher: PasswordHasher = {
    hash: jest.fn().mockResolvedValue('hashed-password'),
    verify: jest.fn().mockResolvedValue(true),
  };
  const roleLookup: RoleLookupPort = {
    existsAndBelongsToCompanyOrSystem: jest.fn().mockResolvedValue(overrides?.roleValid ?? true),
  };
  const companyExists: CompanyExistsPort = {
    exists: jest.fn().mockResolvedValue(overrides?.companyExists ?? true),
  };
  const unitOfWork: UnitOfWork = {
    run: jest.fn((work) => work({})),
  };
  const eventPublisher: DomainEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new CreateUserHandler(
    userRepository,
    passwordHasher,
    roleLookup,
    companyExists,
    unitOfWork,
    eventPublisher,
  );

  return {
    handler,
    userRepository,
    passwordHasher,
    roleLookup,
    companyExists,
    eventPublisher,
    savedUsers,
  };
}

const baseCommand: CreateUserCommand = {
  companyId: 'company-1',
  email: 'nuevo@example.com',
  password: 'Sup3rSecret!123',
  name: 'Nuevo Usuario',
  roles: ['role-1'],
};

describe('CreateUserHandler', () => {
  it('lanza CompanyNotFoundError si CompanyExistsPort dice que la company no existe', async () => {
    const { handler } = buildHandler({ companyExists: false });

    await expect(handler.execute(baseCommand)).rejects.toThrow(CompanyNotFoundError);
  });

  it('lanza DuplicateEmailError si ya existe un usuario con ese email en la company (INV-014)', async () => {
    const existing = User.create({
      companyId: 'company-1',
      email: Email.from('nuevo@example.com'),
      passwordHash: PasswordHash.fromHash('x'),
      name: PersonName.from('Otro'),
      roles: [],
    });
    const { handler } = buildHandler({ existingUser: existing });

    await expect(handler.execute(baseCommand)).rejects.toThrow(DuplicateEmailError);
  });

  it('lanza InvalidRoleAssignmentError si algun roleId no es valido para la company', async () => {
    const { handler } = buildHandler({ roleValid: false });

    await expect(handler.execute(baseCommand)).rejects.toThrow(InvalidRoleAssignmentError);
  });

  it('crea el usuario, lo persiste dentro de UnitOfWork.run() y publica sus eventos de dominio', async () => {
    const { handler, userRepository, eventPublisher, savedUsers } = buildHandler();

    const userId = await handler.execute(baseCommand);

    expect(userId).toBeDefined();
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(savedUsers).toHaveLength(1);
    expect(savedUsers[0].email.toString()).toBe('nuevo@example.com');
    expect(savedUsers[0].roles).toEqual(['role-1']);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'UserCreated.v1', companyId: 'company-1' }),
    );
  });
});
