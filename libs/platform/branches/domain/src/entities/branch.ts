import { EntityId } from '@platform/shared-kernel';

import type { BranchClosedEvent } from '../events/branch-closed.event';
import type { BranchOpenedEvent } from '../events/branch-opened.event';
import type { Address } from '../value-objects/address';
import type { BranchName } from '../value-objects/branch-name';
import type { BranchStatus } from '../value-objects/branch-status';
import type { OperatingHours } from '../value-objects/operating-hours';

export type BranchId = EntityId<'Branch'>;
type BranchDomainEvent = BranchOpenedEvent | BranchClosedEvent;

export interface BranchProps {
  id: BranchId;
  companyId: string;
  name: BranchName;
  address: Address;
  operatingHours: OperatingHours;
  status: BranchStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root propio (no anidado en Company) - docs/model/02-AGGREGATES.md SS5: Vehicle/
// Reservation necesitan referenciarlo por id de forma estable e independiente.
export class Branch {
  private domainEvents: BranchDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: BranchProps) {}

  static create(params: {
    companyId: string;
    name: BranchName;
    address: Address;
    operatingHours: OperatingHours;
  }): Branch {
    const now = new Date();
    const branch = new Branch({
      id: EntityId.generate<'Branch'>(),
      companyId: params.companyId,
      name: params.name,
      address: params.address,
      operatingHours: params.operatingHours,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    branch.domainEvents.push({
      eventType: 'BranchOpened.v1',
      branchId: branch.props.id.toString(),
      companyId: branch.props.companyId,
      address: branch.props.address.toProps(),
    });
    branch.isNewAggregate = true;

    return branch;
  }

  static reconstitute(props: BranchProps): Branch {
    return new Branch(props);
  }

  get id(): BranchId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get name(): BranchName {
    return this.props.name;
  }

  get address(): Address {
    return this.props.address;
  }

  get operatingHours(): OperatingHours {
    return this.props.operatingHours;
  }

  get status(): BranchStatus {
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

  updateDetails(params: {
    name?: BranchName;
    address?: Address;
    operatingHours?: OperatingHours;
  }): void {
    if (params.name) {
      this.props.name = params.name;
    }
    if (params.address) {
      this.props.address = params.address;
    }
    if (params.operatingHours) {
      this.props.operatingHours = params.operatingHours;
    }
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  close(): void {
    if (this.props.status === 'Closed') {
      return;
    }
    this.props.status = 'Closed';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'BranchClosed.v1',
      branchId: this.props.id.toString(),
      companyId: this.props.companyId,
    });
  }

  // Re-emite BranchOpened.v1 (mismo evento que create()) - ver comentario en ese evento.
  reopen(): void {
    if (this.props.status === 'Active') {
      return;
    }
    this.props.status = 'Active';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'BranchOpened.v1',
      branchId: this.props.id.toString(),
      companyId: this.props.companyId,
      address: this.props.address.toProps(),
    });
  }

  pullDomainEvents(): BranchDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
