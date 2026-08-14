import type { Email } from '@platform/shared-kernel';
import { EntityId } from '@platform/shared-kernel';

import { UserDisabledError } from '../errors/user-disabled.error';
import type { UserCreatedEvent } from '../events/user-created.event';
import type { UserDisabledEvent } from '../events/user-disabled.event';
import type { UserPasswordChangedEvent } from '../events/user-password-changed.event';
import type { PasswordHash } from '../value-objects/password-hash';
import type { PersonName } from '../value-objects/person-name';
import type { UserStatus } from '../value-objects/user-status';

export type UserId = EntityId<'User'>;
type UserDomainEvent = UserCreatedEvent | UserDisabledEvent | UserPasswordChangedEvent;

export interface UserProps {
  id: UserId;
  companyId: string;
  branchId?: string;
  email: Email;
  passwordHash: PasswordHash;
  name: PersonName;
  status: UserStatus;
  // Lista de referencias (roleId como string, nunca el RoleId tipado de roles-permissions/
  // domain - type:domain no puede importar el domain/ de otro modulo, INV-P02) - nunca una
  // copia del contenido del Role (docs/model/02-AGGREGATES.md SS1).
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root - docs/model/02-AGGREGATES.md SS1. Pertenece a una Company (obligatorio) y
// opcionalmente a una Branch (scoping operativo, no relacion rica).
export class User {
  private domainEvents: UserDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: UserProps) {}

  static create(params: {
    companyId: string;
    branchId?: string;
    email: Email;
    passwordHash: PasswordHash;
    name: PersonName;
    roles: string[];
  }): User {
    const now = new Date();
    const user = new User({
      id: EntityId.generate<'User'>(),
      companyId: params.companyId,
      branchId: params.branchId,
      email: params.email,
      passwordHash: params.passwordHash,
      name: params.name,
      status: 'Active',
      roles: [...new Set(params.roles)],
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    user.domainEvents.push({
      eventType: 'UserCreated.v1',
      userId: user.props.id.toString(),
      companyId: user.props.companyId,
      branchId: user.props.branchId,
      email: user.props.email.toString(),
      roles: user.props.roles,
    });
    user.isNewAggregate = true;

    return user;
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get id(): UserId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get branchId(): string | undefined {
    return this.props.branchId;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): PasswordHash {
    return this.props.passwordHash;
  }

  get name(): PersonName {
    return this.props.name;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get roles(): readonly string[] {
    return this.props.roles;
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

  // INV-114: un User Disabled no autentica nuevas Session, pero sus Session ya emitidas no
  // se invalidan instantaneamente (trade-off aceptado, ADR-0008, acotado a la vida del
  // access_token).
  disable(disabledBy: string, reason?: string): void {
    if (this.props.status === 'Disabled') {
      return;
    }
    this.props.status = 'Disabled';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'UserDisabled.v1',
      userId: this.props.id.toString(),
      disabledBy,
      reason,
    });
  }

  reactivate(): void {
    this.props.status = 'Active';
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  changePassword(newHash: PasswordHash, changedBy: string): void {
    this.props.passwordHash = newHash;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'UserPasswordChanged.v1',
      userId: this.props.id.toString(),
      changedBy,
    });
  }

  assignRole(roleId: string): void {
    if (this.props.roles.includes(roleId)) {
      return;
    }
    this.props.roles = [...this.props.roles, roleId];
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  revokeRole(roleId: string): void {
    if (!this.props.roles.includes(roleId)) {
      return;
    }
    this.props.roles = this.props.roles.filter((r) => r !== roleId);
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  assertCanAuthenticate(): void {
    if (this.props.status === 'Disabled') {
      throw new UserDisabledError(this.props.id.toString());
    }
  }

  pullDomainEvents(): UserDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
