import { EmptyPermissionSetError } from '../errors/empty-permission-set.error';
import { SystemRoleImmutableError } from '../errors/system-role-immutable.error';
import { Permission } from '../value-objects/permission';
import { RoleName } from '../value-objects/role-name';
import { Role } from './role';

const somePermissions = () => [Permission.from('users:create'), Permission.from('users:edit')];

function createCustomRole(): Role {
  return Role.create({
    companyId: 'company-1',
    roleName: RoleName.from('Operador de Sucursal'),
    scope: 'Custom',
    permissions: somePermissions(),
  });
}

function createSystemRole(): Role {
  return Role.create({
    companyId: null,
    roleName: RoleName.from('Administrador de Empresa'),
    scope: 'System',
    permissions: somePermissions(),
  });
}

describe('Role', () => {
  describe('create', () => {
    it('lanza EmptyPermissionSetError si permissions esta vacio', () => {
      expect(() =>
        Role.create({
          companyId: 'company-1',
          roleName: RoleName.from('Sin Permisos'),
          scope: 'Custom',
          permissions: [],
        }),
      ).toThrow(EmptyPermissionSetError);
    });

    it('crea un role Active y emite RoleCreated.v1', () => {
      const role = createCustomRole();

      expect(role.status).toBe('Active');
      expect(role.isNew).toBe(true);
      const events = role.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'RoleCreated.v1', companyId: 'company-1' });
    });
  });

  describe('editPermissions', () => {
    it('lanza SystemRoleImmutableError sobre un role System', () => {
      const role = createSystemRole();

      expect(() => role.editPermissions(somePermissions())).toThrow(SystemRoleImmutableError);
    });

    it('lanza EmptyPermissionSetError si el nuevo conjunto queda vacio', () => {
      const role = createCustomRole();

      expect(() => role.editPermissions([])).toThrow(EmptyPermissionSetError);
    });

    it('reemplaza el conjunto de permisos y emite RolePermissionsChanged.v1 con el diff correcto', () => {
      const role = createCustomRole();
      role.pullDomainEvents();

      role.editPermissions([Permission.from('users:edit'), Permission.from('roles:create')]);

      expect(role.permissions.map((p) => p.toString())).toEqual(['users:edit', 'roles:create']);
      const events = role.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'RolePermissionsChanged.v1',
        addedPermissions: ['roles:create'],
        removedPermissions: ['users:create'],
      });
    });

    it('no emite RolePermissionsChanged.v1 si el nuevo conjunto es identico (mismo contenido)', () => {
      const role = createCustomRole();
      role.pullDomainEvents();

      role.editPermissions(somePermissions());

      expect(role.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('deactivate', () => {
    it('lanza SystemRoleImmutableError sobre un role System - nunca se desactiva (INV-026)', () => {
      const role = createSystemRole();

      expect(() => role.deactivate()).toThrow(SystemRoleImmutableError);
      expect(role.status).toBe('Active');
    });

    it('transiciona un role Custom a Inactive y emite RoleDeactivated.v1', () => {
      const role = createCustomRole();
      role.pullDomainEvents();

      role.deactivate();

      expect(role.status).toBe('Inactive');
      const events = role.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'RoleDeactivated.v1',
        roleId: role.id.toString(),
      });
    });
  });
});
