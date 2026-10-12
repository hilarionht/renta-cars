import { EntityId } from '@platform/shared-kernel';

import type { CustomerSessionCreatedEvent } from '../events/customer-session-created.event';
import type { CustomerSessionRevokedEvent } from '../events/customer-session-revoked.event';
import type { CustomerDeviceContext } from '../value-objects/customer-device-context';
import type { CustomerRefreshTokenHash } from '../value-objects/customer-refresh-token-hash';
import type { CustomerSessionStatus } from '../value-objects/customer-session-status';

export type CustomerSessionId = EntityId<'CustomerSession'>;
type CustomerSessionDomainEvent = CustomerSessionCreatedEvent | CustomerSessionRevokedEvent;

export interface CustomerSessionProps {
  id: CustomerSessionId;
  customerId: string;
  companyId: string;
  refreshTokenHash: CustomerRefreshTokenHash;
  deviceContext: CustomerDeviceContext;
  status: CustomerSessionStatus;
  issuedAt: Date;
  rotatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Espejo deliberado de libs/platform/identity/domain/src/entities/session.ts - duplicado a
// proposito (Fase 5 cliente-autogestion, docs/persistence/10-DECISIONES.md #109), no una
// abstraccion compartida: el usuario eligio explicitamente una sesion "paralela" para no
// acoplar el mecanismo de auth de staff (ya probado, en produccion) al nuevo de customers.
// Aggregate root propio, NO anidado dentro de Customer - mismo motivo que Session/User (la
// tasa de escritura, cada refresh, es ordenes de magnitud mayor que la de Customer).
export class CustomerSession {
  private domainEvents: CustomerSessionDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: CustomerSessionProps) {}

  // El hash ya viene calculado (infrastructure) - domain/ no genera bytes aleatorios ni
  // calcula hashes, solo modela el ciclo de vida.
  static issue(params: {
    customerId: string;
    companyId: string;
    refreshTokenHash: CustomerRefreshTokenHash;
    deviceContext: CustomerDeviceContext;
  }): CustomerSession {
    const now = new Date();
    const session = new CustomerSession({
      id: EntityId.generate<'CustomerSession'>(),
      customerId: params.customerId,
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
      eventType: 'CustomerSessionCreated.v1',
      customerSessionId: session.props.id.toString(),
      customerId: session.props.customerId,
      deviceUserAgent: session.props.deviceContext.toUserAgent(),
      deviceIpAddress: session.props.deviceContext.toIpAddress(),
    });
    session.isNewAggregate = true;

    return session;
  }

  static reconstitute(props: CustomerSessionProps): CustomerSession {
    return new CustomerSession(props);
  }

  get id(): CustomerSessionId {
    return this.props.id;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get refreshTokenHash(): CustomerRefreshTokenHash {
    return this.props.refreshTokenHash;
  }

  get status(): CustomerSessionStatus {
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

  // Transicion terminal: Active -> Rotated. El llamador (CustomerSessionSecurityService) es
  // responsable de crear la CustomerSession nueva - este metodo solo cierra esta.
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
      eventType: 'CustomerSessionRevoked.v1',
      customerSessionId: this.props.id.toString(),
      customerId: this.props.customerId,
      reason,
    });
  }

  pullDomainEvents(): CustomerSessionDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
