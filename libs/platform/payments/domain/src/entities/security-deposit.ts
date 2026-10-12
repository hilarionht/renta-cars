import { EntityId, type Money } from '@platform/shared-kernel';

import { DepositRetentionExceedsHeldError } from '../errors/deposit-retention-exceeds-held.error';
import { SecurityDepositAlreadyResolvedError } from '../errors/security-deposit-already-resolved.error';
import type { SecurityDepositHeldEvent } from '../events/security-deposit-held.event';
import type { SecurityDepositPartiallyRetainedEvent } from '../events/security-deposit-partially-retained.event';
import type { SecurityDepositReleasedEvent } from '../events/security-deposit-released.event';
import type { DepositStatusValue } from '../value-objects/deposit-status';

export type SecurityDepositId = EntityId<'SecurityDeposit'>;
type SecurityDepositDomainEvent =
  SecurityDepositHeldEvent | SecurityDepositReleasedEvent | SecurityDepositPartiallyRetainedEvent;

export interface SecurityDepositProps {
  id: SecurityDepositId;
  // Infraestructura de aislamiento multi-tenant (RLS) - nunca leido por ninguna regla de
  // negocio de este aggregate (docs/persistence/01-SCHEMAS.md SS4.3, 10-DECISIONES.md #1).
  companyId: string;
  reservationId: string;
  amount: Money;
  status: DepositStatusValue;
  gatewayHoldReference?: string;
  retainedAmount?: Money;
  retentionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root (docs/model/02-AGGREGATES.md SS12) - sin entidades internas. hold() nunca se
// invoca desde un endpoint HTTP - disparado unicamente por el listener de
// ReservationConfirmed.v1 (docs/contracts/02-RESOURCE-CATALOG.md SS5).
export class SecurityDeposit {
  private domainEvents: SecurityDepositDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: SecurityDepositProps) {}

  static hold(params: {
    companyId: string;
    reservationId: string;
    amount: Money;
    gatewayHoldReference?: string;
  }): SecurityDeposit {
    const now = new Date();
    const deposit = new SecurityDeposit({
      id: EntityId.generate<'SecurityDeposit'>(),
      companyId: params.companyId,
      reservationId: params.reservationId,
      amount: params.amount,
      status: 'Held',
      gatewayHoldReference: params.gatewayHoldReference,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    deposit.domainEvents.push({
      eventType: 'SecurityDepositHeld.v1',
      depositId: deposit.props.id.toString(),
      reservationId: deposit.props.reservationId,
      amount: {
        minorUnits: deposit.props.amount.minorUnits,
        currency: deposit.props.amount.currencyCode,
      },
    });
    deposit.isNewAggregate = true;
    return deposit;
  }

  static reconstitute(props: SecurityDepositProps): SecurityDeposit {
    return new SecurityDeposit(props);
  }

  // INV-020: SecurityDeposit resuelto (Released/Retained) es terminal.
  release(): void {
    if (this.props.status !== 'Held') {
      throw new SecurityDepositAlreadyResolvedError(this.props.id.toString(), this.props.status);
    }
    this.props.status = 'ReleasedFully';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'SecurityDepositReleased.v1',
      depositId: this.props.id.toString(),
      reservationId: this.props.reservationId,
    });
  }

  // INV-019: el monto retenido nunca excede el monto originalmente retenido. Gap del catalogo
  // de eventos: no existe SecurityDepositFullyRetained.v1 pese a que RetainedFully es un
  // estado terminal propio - se reutiliza SecurityDepositPartiallyRetained.v1 para ambos casos
  // (el payload retainedAmount distingue parcial vs total comparandolo con amount).
  retain(amount: Money, reason: string): void {
    if (this.props.status !== 'Held') {
      throw new SecurityDepositAlreadyResolvedError(this.props.id.toString(), this.props.status);
    }
    if (
      amount.currencyCode !== this.props.amount.currencyCode ||
      amount.minorUnits > this.props.amount.minorUnits
    ) {
      throw new DepositRetentionExceedsHeldError(this.props.id.toString());
    }
    this.props.status =
      amount.minorUnits === this.props.amount.minorUnits ? 'RetainedFully' : 'RetainedPartially';
    this.props.retainedAmount = amount;
    this.props.retentionReason = reason;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'SecurityDepositPartiallyRetained.v1',
      depositId: this.props.id.toString(),
      reservationId: this.props.reservationId,
      retainedAmount: { minorUnits: amount.minorUnits, currency: amount.currencyCode },
      reason,
    });
  }

  get id(): SecurityDepositId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get reservationId(): string {
    return this.props.reservationId;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get status(): DepositStatusValue {
    return this.props.status;
  }

  get gatewayHoldReference(): string | undefined {
    return this.props.gatewayHoldReference;
  }

  get retainedAmount(): Money | undefined {
    return this.props.retainedAmount;
  }

  get retentionReason(): string | undefined {
    return this.props.retentionReason;
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

  pullDomainEvents(): SecurityDepositDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
