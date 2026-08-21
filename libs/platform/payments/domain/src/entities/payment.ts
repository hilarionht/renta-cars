import { EntityId, type Money } from '@platform/shared-kernel';

import { PaymentInvalidStateTransitionError } from '../errors/payment-invalid-state-transition.error';
import type { PaymentFailedEvent } from '../events/payment-failed.event';
import type { PaymentRefundedEvent } from '../events/payment-refunded.event';
import type { PaymentSucceededEvent } from '../events/payment-succeeded.event';
import type { PaymentMethod } from '../value-objects/payment-method';
import type { PaymentStatusValue } from '../value-objects/payment-status';
import type { PaymentTargetTypeValue } from '../value-objects/payment-target';

export type PaymentId = EntityId<'Payment'>;
type PaymentDomainEvent = PaymentSucceededEvent | PaymentFailedEvent | PaymentRefundedEvent;

export interface PaymentProps {
  id: PaymentId;
  // Infraestructura de aislamiento multi-tenant (RLS) - nunca leido por ninguna regla de
  // negocio de este aggregate (docs/persistence/01-SCHEMAS.md SS4.3, 10-DECISIONES.md #1).
  companyId: string;
  targetType: PaymentTargetTypeValue;
  targetId: string;
  amount: Money;
  method: PaymentMethod;
  status: PaymentStatusValue;
  gatewayReference?: string;
  idempotencyKey: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root (docs/model/02-AGGREGATES.md SS13) - sin entidades internas. Solo 3 eventos
// de dominio reales en el catalogo (PaymentSucceeded/Failed/Refunded.v1) - Requested/
// Authorized son estados internos, nunca eventos propios (docs/model/06-DOMAIN_EVENTS.md SS7).
export class Payment {
  private domainEvents: PaymentDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: PaymentProps) {}

  static request(params: {
    companyId: string;
    targetType: PaymentTargetTypeValue;
    targetId: string;
    amount: Money;
    method: PaymentMethod;
    idempotencyKey: string;
  }): Payment {
    const now = new Date();
    const payment = new Payment({
      id: EntityId.generate<'Payment'>(),
      companyId: params.companyId,
      targetType: params.targetType,
      targetId: params.targetId,
      amount: params.amount,
      method: params.method,
      status: 'Requested',
      idempotencyKey: params.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    payment.isNewAggregate = true;
    return payment;
  }

  static reconstitute(props: PaymentProps): Payment {
    return new Payment(props);
  }

  // Guard: solo Requested (RN-24 - metodos con preautorizacion pasan por aqui antes de
  // capture(); metodos sin preautorizacion saltan authorize() por completo). Sin evento
  // propio - no existe PaymentAuthorized.v1 en el catalogo.
  authorize(gatewayReference: string): void {
    if (this.props.status !== 'Requested') {
      throw new PaymentInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'authorize',
      );
    }
    this.props.status = 'Authorized';
    this.props.gatewayReference = gatewayReference;
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  // Guard: Requested o Authorized - capture() es alcanzable directamente desde Requested para
  // metodos sin preautorizacion (docs/model/08-STATE_MACHINES.md SS3.1).
  capture(gatewayReference?: string): void {
    if (this.props.status !== 'Requested' && this.props.status !== 'Authorized') {
      throw new PaymentInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'capture',
      );
    }
    this.props.status = 'Captured';
    if (gatewayReference) {
      this.props.gatewayReference = gatewayReference;
    }
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'PaymentSucceeded.v1',
      paymentId: this.props.id.toString(),
      targetType: this.props.targetType,
      targetId: this.props.targetId,
      amount: {
        minorUnits: this.props.amount.minorUnits,
        currency: this.props.amount.currencyCode,
      },
      method: this.props.method.toString(),
    });
  }

  fail(reason: string): void {
    if (this.props.status !== 'Requested' && this.props.status !== 'Authorized') {
      throw new PaymentInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'fail',
      );
    }
    this.props.status = 'Failed';
    this.props.failureReason = reason;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'PaymentFailed.v1',
      paymentId: this.props.id.toString(),
      targetType: this.props.targetType,
      targetId: this.props.targetId,
      reason,
    });
  }

  refund(): void {
    if (this.props.status !== 'Captured') {
      throw new PaymentInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'refund',
      );
    }
    this.props.status = 'Refunded';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'PaymentRefunded.v1',
      paymentId: this.props.id.toString(),
      amount: {
        minorUnits: this.props.amount.minorUnits,
        currency: this.props.amount.currencyCode,
      },
    });
  }

  get id(): PaymentId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get targetType(): PaymentTargetTypeValue {
    return this.props.targetType;
  }

  get targetId(): string {
    return this.props.targetId;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get method(): PaymentMethod {
    return this.props.method;
  }

  get status(): PaymentStatusValue {
    return this.props.status;
  }

  get gatewayReference(): string | undefined {
    return this.props.gatewayReference;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get failureReason(): string | undefined {
    return this.props.failureReason;
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

  pullDomainEvents(): PaymentDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
