import { EntityId, type DateRange } from '@platform/shared-kernel';

import type { AvailabilitySlotCreatedEvent } from '../events/availability-slot-created.event';
import type { AvailabilitySlotReleasedEvent } from '../events/availability-slot-released.event';
import type { ResourceRef } from '../value-objects/resource-ref';
import type { SlotKindValue } from '../value-objects/slot-kind';
import type { SlotStatusValue } from '../value-objects/slot-status';

export type AvailabilitySlotId = EntityId<'AvailabilitySlot'>;
type AvailabilitySlotDomainEvent = AvailabilitySlotCreatedEvent | AvailabilitySlotReleasedEvent;

export interface AvailabilitySlotProps {
  id: AvailabilitySlotId;
  // Infraestructura de aislamiento multi-tenant (RLS) - nunca leido por ninguna regla de
  // negocio de este aggregate (docs/persistence/01-SCHEMAS.md SS4.3, 10-DECISIONES.md #1).
  companyId: string;
  resourceRef: ResourceRef;
  dateRange: DateRange;
  slotKind: SlotKindValue;
  status: SlotStatusValue;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root (docs/model/02-AGGREGATES.md SS7) - sin entidades internas, el mas simple
// construido hasta ahora. Reglas de modificacion: solo via CalendarPort (application/) -
// nunca expuesto como recurso HTTP mutable (docs/contracts/02-RESOURCE-CATALOG.md SS3).
export class AvailabilitySlot {
  private domainEvents: AvailabilitySlotDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: AvailabilitySlotProps) {}

  static occupy(params: {
    companyId: string;
    resourceRef: ResourceRef;
    dateRange: DateRange;
    slotKind: SlotKindValue;
  }): AvailabilitySlot {
    const now = new Date();
    const slot = new AvailabilitySlot({
      id: EntityId.generate<'AvailabilitySlot'>(),
      companyId: params.companyId,
      resourceRef: params.resourceRef,
      dateRange: params.dateRange,
      slotKind: params.slotKind,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    slot.domainEvents.push({
      eventType: 'AvailabilitySlotCreated.v1',
      slotId: slot.props.id.toString(),
      resourceType: slot.props.resourceRef.type,
      resourceId: slot.props.resourceRef.id,
      dateRange: {
        start: slot.props.dateRange.start.toISOString(),
        end: slot.props.dateRange.end.toISOString(),
      },
      slotKind: slot.props.slotKind.type,
    });
    slot.isNewAggregate = true;
    return slot;
  }

  static reconstitute(props: AvailabilitySlotProps): AvailabilitySlot {
    return new AvailabilitySlot(props);
  }

  get id(): AvailabilitySlotId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get resourceRef(): ResourceRef {
    return this.props.resourceRef;
  }

  get dateRange(): DateRange {
    return this.props.dateRange;
  }

  get slotKind(): SlotKindValue {
    return this.props.slotKind;
  }

  get status(): SlotStatusValue {
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

  // Idempotente: no-op silencioso si ya Released - mismo criterio de toda la sesion
  // (Company.suspend(), Customer.block()). Sin metodo de "editar rango" - un cambio de
  // fechas es release() + occupy() nuevo, orquestado por el futuro AvailabilityService
  // (docs/model/02-AGGREGATES.md SS7: "nunca editado en el rango").
  release(): void {
    if (this.props.status === 'Released') {
      return;
    }
    this.props.status = 'Released';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'AvailabilitySlotReleased.v1',
      slotId: this.props.id.toString(),
      resourceType: this.props.resourceRef.type,
      resourceId: this.props.resourceRef.id,
    });
  }

  pullDomainEvents(): AvailabilitySlotDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
