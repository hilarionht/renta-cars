import { EntityId } from '@platform/shared-kernel';

import { EmptyPermissionSetError } from '../errors/empty-permission-set.error';
import { SystemRoleImmutableError } from '../errors/system-role-immutable.error';
import type { RoleCreatedEvent } from '../events/role-created.event';
import type { RoleDeactivatedEvent } from '../events/role-deactivated.event';
import type { RolePermissionsChangedEvent } from '../events/role-permissions-changed.event';
import type { Permission } from '../value-objects/permission';
import type { RoleName } from '../value-objects/role-name';
import type { RoleScope } from '../value-objects/role-scope';
import type { RoleStatus } from '../value-objects/role-status';

export type RoleId = EntityId<'Role'>;
type RoleDomainEvent = RoleCreatedEvent | RolePermissionsChangedEvent | RoleDeactivatedEvent;

export interface RoleProps {
  id: RoleId;
  companyId: string | null;
  roleName: RoleName;
  scope: RoleScope;
  status: RoleStatus;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root - docs/model/02-AGGREGATES.md SS2. companyId nulo = System (catalogo
// global, INV-026 inmutable); nunca referencia a User (unidireccional por diseño,
// docs/model/03-ENTITIES.md SS1.2).
export class Role {
  private domainEvents: RoleDomainEvent[] = [];
  // Distingue INSERT vs UPDATE en el repositorio sin que infrastructure/ tenga que adivinar
  // por otro medio (p.ej. version === 1, que tambien podria ser un role recien cargado sin
  // ediciones) - true solo entre `create()` y el primer `save()`.
  private isNewAggregate = false;

  private constructor(private props: RoleProps) {}

  static create(params: {
    companyId: string | null;
    roleName: RoleName;
    scope: RoleScope;
    permissions: Permission[];
  }): Role {
    if (params.permissions.length === 0) {
      throw new EmptyPermissionSetError('(nuevo)');
    }

    const now = new Date();
    const role = new Role({
      id: EntityId.generate<'Role'>(),
      companyId: params.companyId,
      roleName: params.roleName,
      scope: params.scope,
      status: 'Active',
      permissions: params.permissions,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    role.domainEvents.push({
      eventType: 'RoleCreated.v1',
      roleId: role.props.id.toString(),
      companyId: role.props.companyId,
      scope: role.props.scope,
    });
    role.isNewAggregate = true;

    return role;
  }

  static reconstitute(props: RoleProps): Role {
    return new Role(props);
  }

  get id(): RoleId {
    return this.props.id;
  }

  get companyId(): string | null {
    return this.props.companyId;
  }

  get roleName(): RoleName {
    return this.props.roleName;
  }

  get scope(): RoleScope {
    return this.props.scope;
  }

  get status(): RoleStatus {
    return this.props.status;
  }

  get permissions(): readonly Permission[] {
    return this.props.permissions;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewAggregate;
  }

  markPersisted(): void {
    this.isNewAggregate = false;
  }

  editPermissions(newPermissions: Permission[]): void {
    this.assertNotSystem();
    if (newPermissions.length === 0) {
      throw new EmptyPermissionSetError(this.props.id.toString());
    }

    const before = new Set(this.props.permissions.map((p) => p.toString()));
    const after = new Set(newPermissions.map((p) => p.toString()));
    const added = [...after].filter((p) => !before.has(p));
    const removed = [...before].filter((p) => !after.has(p));

    this.props.permissions = newPermissions;
    this.props.updatedAt = new Date();
    this.props.version += 1;

    if (added.length > 0 || removed.length > 0) {
      this.domainEvents.push({
        eventType: 'RolePermissionsChanged.v1',
        roleId: this.props.id.toString(),
        addedPermissions: added,
        removedPermissions: removed,
      });
    }
  }

  deactivate(): void {
    this.assertNotSystem();
    this.props.status = 'Inactive';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({ eventType: 'RoleDeactivated.v1', roleId: this.props.id.toString() });
  }

  private assertNotSystem(): void {
    if (this.props.scope === 'System') {
      throw new SystemRoleImmutableError(this.props.id.toString());
    }
  }

  pullDomainEvents(): RoleDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
