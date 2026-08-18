import { EntityId, type Money } from '@platform/shared-kernel';

import { RateOverlapError } from '../errors/rate-overlap.error';
import type { RateChangedEvent } from '../events/rate-changed.event';
import type { VehicleCategoryCreatedEvent } from '../events/vehicle-category-created.event';
import type { CategoryName } from '../value-objects/category-name';
import type { RateUnitValue } from '../value-objects/rate-unit';
import { Rate } from './rate';

export type VehicleCategoryId = EntityId<'VehicleCategory'>;
type VehicleCategoryDomainEvent = VehicleCategoryCreatedEvent | RateChangedEvent;

export interface VehicleCategoryProps {
  id: VehicleCategoryId;
  companyId: string;
  name: CategoryName;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root (docs/model/02-AGGREGATES.md SS9) - un unico hijo interno (Rate), mismo
// patron de dirty-tracking que Customer pero mas simple (una sola coleccion).
export class VehicleCategory {
  private domainEvents: VehicleCategoryDomainEvent[] = [];
  private isNewAggregate = false;
  private rates: Rate[] = [];
  private dirtyRateIds = new Set<string>();

  private constructor(private props: VehicleCategoryProps) {}

  static create(params: {
    companyId: string;
    name: CategoryName;
    description?: string;
  }): VehicleCategory {
    const now = new Date();
    const category = new VehicleCategory({
      id: EntityId.generate<'VehicleCategory'>(),
      companyId: params.companyId,
      name: params.name,
      description: params.description,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    category.domainEvents.push({
      eventType: 'VehicleCategoryCreated.v1',
      categoryId: category.props.id.toString(),
      companyId: category.props.companyId,
      name: category.props.name.toString(),
    });
    category.isNewAggregate = true;
    return category;
  }

  static reconstitute(props: VehicleCategoryProps, rates: Rate[]): VehicleCategory {
    const category = new VehicleCategory(props);
    category.rates = rates;
    return category;
  }

  get id(): VehicleCategoryId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get name(): CategoryName {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewAggregate;
  }

  get allRates(): Rate[] {
    return this.rates;
  }

  markPersisted(): void {
    this.isNewAggregate = false;
  }

  // Capa 1 de defensa (en memoria) contra INV-010 - la exclusion constraint GiST en
  // Postgres es la capa 2, autoritativa (ver PrismaVehicleCategoryRepository).
  addRate(params: {
    amount: Money;
    unit: RateUnitValue;
    validFrom: Date;
    validTo?: Date | null;
  }): Rate['id'] {
    const rate = Rate.create(params);
    if (this.rates.some((existing) => existing.overlaps(rate))) {
      throw new RateOverlapError(this.props.id.toString());
    }
    this.rates.push(rate);
    this.dirtyRateIds.add(rate.id.toString());
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'RateChanged.v1',
      categoryId: this.props.id.toString(),
      rateId: rate.id.toString(),
      amount: { minorUnits: rate.amount.minorUnits, currency: rate.amount.currencyCode },
      validFrom: rate.validFrom.toISOString(),
    });
    return rate.id;
  }

  pullDomainEvents(): VehicleCategoryDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }

  pullDirtyRates(): Rate[] {
    const dirty = this.rates.filter((rate) => this.dirtyRateIds.has(rate.id.toString()));
    this.dirtyRateIds.clear();
    return dirty;
  }
}
