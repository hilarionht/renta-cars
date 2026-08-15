import { Email } from '@platform/shared-kernel';

import { UserDisabledError } from '../errors/user-disabled.error';
import { PasswordHash } from '../value-objects/password-hash';
import { PersonName } from '../value-objects/person-name';
import { User } from './user';

function createUser(roles: string[] = ['role-1']): User {
  return User.create({
    companyId: 'company-1',
    email: Email.from('operador@example.com'),
    passwordHash: PasswordHash.fromHash('hashed-value'),
    name: PersonName.from('Operador de Sucursal'),
    roles,
  });
}

describe('User', () => {
  describe('create', () => {
    it('crea un usuario Active, deduplica roles repetidos y emite UserCreated.v1', () => {
      const user = User.create({
        companyId: 'company-1',
        email: Email.from('dup@example.com'),
        passwordHash: PasswordHash.fromHash('hashed-value'),
        name: PersonName.from('Nombre Test'),
        roles: ['role-1', 'role-1', 'role-2'],
      });

      expect(user.status).toBe('Active');
      expect(user.roles).toEqual(['role-1', 'role-2']);
      expect(user.isNew).toBe(true);
      const events = user.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'UserCreated.v1', email: 'dup@example.com' });
    });
  });

  describe('disable/reactivate', () => {
    it('disable() transiciona a Disabled, emite UserDisabled.v1, y es idempotente', () => {
      const user = createUser();
      user.pullDomainEvents();

      user.disable('admin-1', 'incumplimiento');
      expect(user.status).toBe('Disabled');
      const events = user.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'UserDisabled.v1',
        disabledBy: 'admin-1',
        reason: 'incumplimiento',
      });

      // Segunda llamada sobre un usuario ya Disabled: no-op, sin evento duplicado.
      user.disable('admin-2');
      expect(user.pullDomainEvents()).toHaveLength(0);
    });

    it('reactivate() vuelve a Active sin emitir evento propio', () => {
      const user = createUser();
      user.disable('admin-1');
      user.pullDomainEvents();

      user.reactivate();

      expect(user.status).toBe('Active');
      expect(user.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('assertCanAuthenticate', () => {
    it('no lanza sobre un usuario Active', () => {
      const user = createUser();
      expect(() => user.assertCanAuthenticate()).not.toThrow();
    });

    it('lanza UserDisabledError sobre un usuario Disabled (INV-114)', () => {
      const user = createUser();
      user.disable('admin-1');

      expect(() => user.assertCanAuthenticate()).toThrow(UserDisabledError);
    });
  });

  describe('assignRole/revokeRole', () => {
    it('assignRole agrega un role nuevo, es idempotente si ya estaba asignado', () => {
      const user = createUser(['role-1']);

      user.assignRole('role-2');
      expect(user.roles).toEqual(['role-1', 'role-2']);

      user.assignRole('role-2');
      expect(user.roles).toEqual(['role-1', 'role-2']);
    });

    it('revokeRole quita un role asignado, es idempotente si no estaba asignado', () => {
      const user = createUser(['role-1', 'role-2']);

      user.revokeRole('role-1');
      expect(user.roles).toEqual(['role-2']);

      user.revokeRole('role-1');
      expect(user.roles).toEqual(['role-2']);
    });
  });

  describe('changePassword', () => {
    it('reemplaza el hash y emite UserPasswordChanged.v1', () => {
      const user = createUser();
      user.pullDomainEvents();

      user.changePassword(PasswordHash.fromHash('new-hash'), 'admin-1');

      expect(user.passwordHash.toString()).toBe('new-hash');
      const events = user.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'UserPasswordChanged.v1',
        changedBy: 'admin-1',
      });
    });
  });
});
