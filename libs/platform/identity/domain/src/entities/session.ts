import { EntityId } from '@platform/shared-kernel';

import type { SessionCreatedEvent } from '../events/session-created.event';
import type { SessionRevokedEvent } from '../events/session-revoked.event';
import type { DeviceContext } from '../value-objects/device-context';
import type { RefreshTokenHash } from '../value-objects/refresh-token-hash';
import type { SessionStatus } from '../value-objects/session-status';

export type SessionId = EntityId<'Session'>;
type SessionDomainEvent = SessionCreatedEvent | SessionRevokedEvent;

export interface SessionProps {
  id: SessionId;
  userId: string;
  companyId: string;
  refreshTokenHash: RefreshTokenHash;
  deviceContext: DeviceContext;
  status: SessionStatus;
  issuedAt: Date;
  rotatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root propio, NO anidado dentro de User - la tasa de escritura de Session (cada
// refresh) es ordenes de magnitud mayor que la de User; anidarlos forzaria cargar/bloquear
// el agregado User completo en cada refresh (docs/model/02-AGGREGATES.md SS3). Leaf del
// grafo de dominio - nada mas lo referencia.
export class Session {
  private domainEvents: SessionDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: SessionProps) {}

  // El hash ya viene calculado (RefreshTokenHasher, infrastructure) - domain/ no genera
  // bytes aleatorios ni calcula hashes, solo modela el ciclo de vida.
  static issue(params: {
    userId: string;
    companyId: string;
    refreshTokenHash: RefreshTokenHash;
    deviceContext: DeviceContext;
  }): Session {
    const now = new Date();
    const session = new Session({
      id: EntityId.generate<'Session'>(),
      userId: params.userId,
      companyId: params.companyId,
      refreshTokenHash: params.refreshTokenHash,
      deviceContext: params.deviceContext,
      status: 'Active',
      issuedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    session.domainEvents.push({
      eventType: 'SessionCreated.v1',
      sessionId: session.props.id.toString(),
      userId: session.props.userId,
      deviceUserAgent: session.props.deviceContext.toUserAgent(),
      deviceIpAddress: session.props.deviceContext.toIpAddress(),
    });
    session.isNewAggregate = true;

    return session;
  }

  static reconstitute(props: SessionProps): Session {
    return new Session(props);
  }

  get id(): SessionId {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get refreshTokenHash(): RefreshTokenHash {
    return this.props.refreshTokenHash;
  }

  get status(): SessionStatus {
    return this.props.status;
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

  // Transicion terminal: Active -> Rotated. El llamador (SessionSecurityService) es
  // responsable de crear la Session nueva - este metodo solo cierra esta.
  markRotated(): void {
    this.props.status = 'Rotated';
    this.props.rotatedAt = new Date();
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  revoke(reason: string): void {
    if (this.props.status === 'Revoked') {
      return;
    }
    this.props.status = 'Revoked';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'SessionRevoked.v1',
      sessionId: this.props.id.toString(),
      userId: this.props.userId,
      reason,
    });
  }

  pullDomainEvents(): SessionDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
