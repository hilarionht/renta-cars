import { EntityId } from '@platform/shared-kernel';

import { NotificationInvalidStateTransitionError } from '../errors/notification-invalid-state-transition.error';
import type { NotificationDeliveredEvent } from '../events/notification-delivered.event';
import type { NotificationFailedEvent } from '../events/notification-failed.event';
import type { NotificationSentEvent } from '../events/notification-sent.event';
import type { ChannelValue } from '../value-objects/channel';
import type { NotificationKindValue } from '../value-objects/notification-kind';
import type { NotificationStatusValue } from '../value-objects/notification-status';
import type { Recipient } from '../value-objects/recipient';

export type NotificationId = EntityId<'Notification'>;
type NotificationDomainEvent =
  NotificationSentEvent | NotificationDeliveredEvent | NotificationFailedEvent;

export interface NotificationProps {
  id: NotificationId;
  // Infraestructura de aislamiento multi-tenant (RLS) - nunca leido por ninguna regla de
  // negocio de este aggregate (docs/persistence/01-SCHEMAS.md SS4.3, 10-DECISIONES.md #1).
  companyId: string;
  kind: NotificationKindValue;
  status: NotificationStatusValue;
  recipient: Recipient;
  templateId: string;
  channel?: ChannelValue;
  providerReference?: string;
  failureReason?: string;
  channelsExhausted: boolean;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root (docs/model/02-AGGREGATES.md SS16) - sin entidades internas. 3 transiciones,
// reconciliando las 2 flechas documentadas del diagrama-resumen (docs/persistence/
// 10-DECISIONES.md Fase 3, Hallazgo #3): send()/fail() se alcanzan directo desde Pending (el
// reintento entre canales de RN-34 ocurre en application/ ANTES de esta llamada, probando
// canales hasta que uno es aceptado); markFailed() honra la flecha Sent->Failed documentada
// literalmente - un fallo asincrono posterior a la aceptacion (p.ej. WhatsApp reporta via
// webhook de estado que un mensaje ya aceptado termino fallando en destino).
export class Notification {
  private domainEvents: NotificationDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: NotificationProps) {}

  static create(params: {
    companyId: string;
    kind: NotificationKindValue;
    recipient: Recipient;
    templateId: string;
  }): Notification {
    const now = new Date();
    const notification = new Notification({
      id: EntityId.generate<'Notification'>(),
      companyId: params.companyId,
      kind: params.kind,
      status: 'Pending',
      recipient: params.recipient,
      templateId: params.templateId,
      channelsExhausted: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    notification.isNewAggregate = true;
    return notification;
  }

  static reconstitute(props: NotificationProps): Notification {
    return new Notification(props);
  }

  // Un canal acepto el mensaje para entrega (docs/contracts/05-INTEGRATION-CONTRACTS.md SS1)
  // - el reintento entre canales de RN-34 ya ocurrio en application/ antes de esta llamada.
  send(channel: ChannelValue, providerReference: string): void {
    if (this.props.status !== 'Pending') {
      throw new NotificationInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'send',
      );
    }
    this.props.status = 'Sent';
    this.props.channel = channel;
    this.props.providerReference = providerReference;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'NotificationSent.v1',
      notificationId: this.props.id.toString(),
      channel,
      kind: this.props.kind,
    });
  }

  markDelivered(): void {
    if (this.props.status !== 'Sent') {
      throw new NotificationInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'markDelivered',
      );
    }
    const deliveredAt = new Date();
    this.props.status = 'Delivered';
    this.props.deliveredAt = deliveredAt;
    this.props.updatedAt = deliveredAt;
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'NotificationDelivered.v1',
      notificationId: this.props.id.toString(),
      deliveredAt: deliveredAt.toISOString(),
    });
  }

  // Reintento sincrono agotado antes de que ningun canal aceptara el mensaje - nunca se
  // llego a Sent (docs/persistence/10-DECISIONES.md Fase 3, Hallazgo #3).
  fail(reason: string, channelsExhausted: boolean): void {
    if (this.props.status !== 'Pending') {
      throw new NotificationInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'fail',
      );
    }
    this.props.status = 'Failed';
    this.props.failureReason = reason;
    this.props.channelsExhausted = channelsExhausted;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'NotificationFailed.v1',
      notificationId: this.props.id.toString(),
      reason,
      channelsExhausted,
    });
  }

  // Fallo asincrono posterior a la aceptacion (webhook de estado) - el canal SI acepto el
  // mensaje, esto no es un agotamiento de reintento (channelsExhausted: false).
  markFailed(reason: string): void {
    if (this.props.status !== 'Sent') {
      throw new NotificationInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'markFailed',
      );
    }
    this.props.status = 'Failed';
    this.props.failureReason = reason;
    this.props.channelsExhausted = false;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'NotificationFailed.v1',
      notificationId: this.props.id.toString(),
      reason,
      channelsExhausted: false,
    });
  }

  get id(): NotificationId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get kind(): NotificationKindValue {
    return this.props.kind;
  }

  get status(): NotificationStatusValue {
    return this.props.status;
  }

  get recipient(): Recipient {
    return this.props.recipient;
  }

  get templateId(): string {
    return this.props.templateId;
  }

  get channel(): ChannelValue | undefined {
    return this.props.channel;
  }

  get providerReference(): string | undefined {
    return this.props.providerReference;
  }

  get failureReason(): string | undefined {
    return this.props.failureReason;
  }

  get channelsExhausted(): boolean {
    return this.props.channelsExhausted;
  }

  get deliveredAt(): Date | undefined {
    return this.props.deliveredAt;
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

  pullDomainEvents(): NotificationDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
