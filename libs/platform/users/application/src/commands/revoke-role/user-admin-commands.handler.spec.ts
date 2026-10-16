import { Email, type DomainEventPublisher, type UnitOfWork } from '@platform/shared-kernel';
import { PasswordHash, PersonName, User } from '@platform/users/domain';
import type { LastAdministratorGuard } from '@platform/roles-permissions/application';

import type { UserRepository } from '../../ports/user.repository';
import { DisableUserHandler } from '../disable-user/disable-user.handler';
import { ReactivateUserHandler } from '../reactivate-user/reactivate-user.handler';
import { RevokeRoleHandler } from './revoke-role.handler';

// docs/persistence/10-DECISIONES.md #140: no-op idempotente (sin 409 espurio), ultimo
// administrador verificado dentro de la transaccion, y eventos para la auditoria.
function buildUser(roles: string[] = ['role-1']): User {
  const user = User.create({
    companyId: 'company-1',
    email: Email.from('op@example.com'),
    passwordHash: PasswordHash.fromHash('hash'),
    name: PersonName.from('Operador'),
    roles,
  });
  user.pullDomainEvents();
  return user;
}

function build(user: User) {
  const userRepository: UserRepository = {
    findById: jest.fn().mockResolvedValue(user),
    findByCompanyAndEmail: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const guard = { assertAdministratorRemains: jest.fn().mockResolvedValue(undefined) };
  const lastAdministratorGuard = guard as unknown as LastAdministratorGuard;
  return {
    userRepository,
    eventPublisher,
    guard,
    revoke: new RevokeRoleHandler(
      userRepository,
      unitOfWork,
      eventPublisher,
      lastAdministratorGuard,
    ),
    disable: new DisableUserHandler(
      userRepository,
      unitOfWork,
      eventPublisher,
      lastAdministratorGuard,
    ),
    reactivate: new ReactivateUserHandler(userRepository, unitOfWork, eventPublisher),
  };
}

describe('comandos de usuario (#140)', () => {
  it('revocar un rol que no tiene no guarda ni consulta el guard', async () => {
    const user = buildUser(['role-1']);
    const { revoke, userRepository, guard } = build(user);

    await revoke.execute({ companyId: 'company-1', userId: user.id.toString(), roleId: 'role-9' });

    expect(userRepository.save).not.toHaveBeenCalled();
    expect(guard.assertAdministratorRemains).not.toHaveBeenCalled();
  });

  it('revocar verifica el ultimo administrador, guarda y emite UserRoleRevoked.v1', async () => {
    const user = buildUser(['role-1']);
    const { revoke, userRepository, guard, eventPublisher } = build(user);

    await revoke.execute({ companyId: 'company-1', userId: user.id.toString(), roleId: 'role-1' });

    expect(guard.assertAdministratorRemains).toHaveBeenCalledWith({}, 'company-1', {
      kind: 'revoke-role',
      userId: user.id.toString(),
      roleId: 'role-1',
    });
    expect(userRepository.save).toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventType: 'UserRoleRevoked.v1' }),
    );
  });

  it('si el guard rechaza, no guarda', async () => {
    const user = buildUser(['role-1']);
    const { disable, userRepository, guard } = build(user);
    guard.assertAdministratorRemains.mockRejectedValue(new Error('LAST_ADMINISTRATOR'));

    await expect(
      disable.execute({ companyId: 'company-1', userId: user.id.toString(), disabledBy: 'admin' }),
    ).rejects.toThrow('LAST_ADMINISTRATOR');
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('deshabilitar dos veces no guarda la segunda', async () => {
    const user = buildUser();
    user.disable('admin');
    user.pullDomainEvents();
    const { disable, userRepository } = build(user);

    await disable.execute({
      companyId: 'company-1',
      userId: user.id.toString(),
      disabledBy: 'admin',
    });

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('reactivar emite UserReactivated.v1', async () => {
    const user = buildUser();
    user.disable('admin');
    user.pullDomainEvents();
    const { reactivate, eventPublisher } = build(user);

    await reactivate.execute({ companyId: 'company-1', userId: user.id.toString() });

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventType: 'UserReactivated.v1' }),
    );
  });
});
