import { DateRange, EntityId, type Money } from '@platform/shared-kernel';

import { BranchClosedError } from '../errors/branch-closed.error';
import { CustomerNotEligibleError } from '../errors/customer-not-eligible.error';
import { DriverNotValidatedError } from '../errors/driver-not-validated.error';
import { ExtensionCollidesError } from '../errors/extension-collides.error';
import { InspectionRequiredError } from '../errors/inspection-required.error';
import { InvoiceNotYetIssuedError } from '../errors/invoice-not-yet-issued.error';
import { ReservationInvalidStateTransitionError } from '../errors/reservation-invalid-state-transition.error';
import { VehicleNotAvailableError } from '../errors/vehicle-not-available.error';
import type { ExtensionApprovedEvent } from '../events/extension-approved.event';
import type { ExtensionRequestedEvent } from '../events/extension-requested.event';
import type { NoShowRegisteredEvent } from '../events/no-show-registered.event';
import type { PriceBreakdownPayload } from '../events/price-breakdown-payload';
import type { ReservationCancelledEvent } from '../events/reservation-cancelled.event';
import type { ReservationCheckedInEvent } from '../events/reservation-checked-in.event';
import type { ReservationCheckedOutEvent } from '../events/reservation-checked-out.event';
import type { ReservationClosedEvent } from '../events/reservation-closed.event';
import type { ReservationConfirmedEvent } from '../events/reservation-confirmed.event';
import type { ReservationCreatedEvent } from '../events/reservation-created.event';
import type { ReservationRescheduledEvent } from '../events/reservation-rescheduled.event';
import type { VehicleSwappedEvent } from '../events/vehicle-swapped.event';
import type { DamageSeverityValue } from '../value-objects/damage-severity';
import type { FuelLevel } from '../value-objects/fuel-level';
import type { Odometer } from '../value-objects/odometer';
import type { ReservationStatusValue } from '../value-objects/reservation-status';
import { DamageReport } from './damage-report';
import { Inspection, type InspectionId } from './inspection';
import { PriceAdjustment } from './price-adjustment';

export type ReservationId = EntityId<'Reservation'>;

type ReservationDomainEvent =
  | ReservationCreatedEvent
  | ReservationConfirmedEvent
  | ReservationCancelledEvent
  | ReservationCheckedOutEvent
  | ReservationRescheduledEvent
  | ExtensionRequestedEvent
  | ExtensionApprovedEvent
  | VehicleSwappedEvent
  | ReservationCheckedInEvent
  | NoShowRegisteredEvent
  | ReservationClosedEvent;

export interface ReservationProps {
  id: ReservationId;
  companyId: string;
  customerId: string;
  vehicleId: string;
  dateRange: DateRange;
  status: ReservationStatusValue;
  authorizedDriverIds: string[];
  baseAmount: Money;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

interface DamageInput {
  description: string;
  severity: DamageSeverityValue;
  imputableToCustomer: boolean;
  photoFileIds: string[];
}

// Aggregate root (docs/model/02-AGGREGATES.md SS11) - entidades internas en tablas propias
// (Inspection, DamageReport, PriceAdjustment), mismo diseno de persistencia con
// dirty-tracking que Vehicle/Customer (docs/persistence/10-DECISIONES.md #36).
// authorizedDriverIds es un campo simple, no una coleccion con dirty-tracking - se fija
// integramente en create() y nunca se modifica despues (docs/persistence/
// 10-DECISIONES.md #59, catalogo de recursos sin operacion "declare-driver" propia).
// domain/ nunca invoca puertos - confirm()/checkOut()/checkIn()/reschedule()/
// approveExtension()/swapVehicle() reciben los hechos externos ya resueltos (booleans/
// Money) desde el Command Handler de aplicacion (AvailabilityService/PricingService/
// CustomerLookupPort/VehicleStatusPort/BranchLookupPort), mismo criterio que
// Vehicle.enable().
export class Reservation {
  private domainEvents: ReservationDomainEvent[] = [];
  private isNewAggregate = false;
  private inspections: Inspection[] = [];
  private damageReports: DamageReport[] = [];
  private priceAdjustments: PriceAdjustment[] = [];
  private dirtyInspectionIds = new Set<string>();
  private dirtyDamageReportIds = new Set<string>();
  private dirtyPriceAdjustmentIds = new Set<string>();

  private constructor(private props: ReservationProps) {}

  static create(params: {
    companyId: string;
    customerId: string;
    vehicleId: string;
    dateRange: DateRange;
    baseAmount: Money;
    authorizedDriverIds?: string[];
  }): Reservation {
    const now = new Date();
    const reservation = new Reservation({
      id: EntityId.generate<'Reservation'>(),
      companyId: params.companyId,
      customerId: params.customerId,
      vehicleId: params.vehicleId,
      dateRange: params.dateRange,
      status: 'Draft',
      authorizedDriverIds: params.authorizedDriverIds ?? [],
      baseAmount: params.baseAmount,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
    reservation.domainEvents.push({
      eventType: 'ReservationCreated.v1',
      reservationId: reservation.props.id.toString(),
      customerId: reservation.props.customerId,
      vehicleId: reservation.props.vehicleId,
      dateRange: rangePayload(reservation.props.dateRange),
      status: 'Draft',
    });
    reservation.isNewAggregate = true;
    return reservation;
  }

  static reconstitute(
    props: ReservationProps,
    inspections: Inspection[],
    damageReports: DamageReport[],
    priceAdjustments: PriceAdjustment[],
  ): Reservation {
    const reservation = new Reservation(props);
    reservation.inspections = inspections;
    reservation.damageReports = damageReports;
    reservation.priceAdjustments = priceAdjustments;
    return reservation;
  }

  get id(): ReservationId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get vehicleId(): string {
    return this.props.vehicleId;
  }

  get dateRange(): DateRange {
    return this.props.dateRange;
  }

  get status(): ReservationStatusValue {
    return this.props.status;
  }

  get authorizedDriverIds(): string[] {
    return this.props.authorizedDriverIds;
  }

  get baseAmount(): Money {
    return this.props.baseAmount;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewAggregate;
  }

  get allInspections(): Inspection[] {
    return this.inspections;
  }

  get allDamageReports(): DamageReport[] {
    return this.damageReports;
  }

  get allPriceAdjustments(): PriceAdjustment[] {
    return this.priceAdjustments;
  }

  markPersisted(): void {
    this.isNewAggregate = false;
  }

  confirm(params: {
    baseAmount: Money;
    isCustomerEligible: boolean;
    areDriversValidated: boolean;
  }): void {
    this.assertStatus('Draft', 'confirm');
    if (!params.isCustomerEligible) {
      throw new CustomerNotEligibleError(this.props.customerId);
    }
    if (!params.areDriversValidated) {
      throw new DriverNotValidatedError(this.props.id.toString());
    }
    this.props.status = 'Confirmed';
    this.props.baseAmount = params.baseAmount;
    this.touch();
    this.domainEvents.push({
      eventType: 'ReservationConfirmed.v1',
      reservationId: this.props.id.toString(),
      customerId: this.props.customerId,
      vehicleId: this.props.vehicleId,
      dateRange: rangePayload(this.props.dateRange),
      priceBreakdown: this.priceBreakdownPayload(),
    });
  }

  cancel(params: { cancelledBy: string; penalty?: Money; penaltyReason?: string }): void {
    if (this.props.status !== 'Draft' && this.props.status !== 'Confirmed') {
      throw new ReservationInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'cancel',
      );
    }
    const penaltyAdjustment = this.registerPenaltyIfAny(params.penalty, params.penaltyReason);
    this.props.status = 'Cancelled';
    this.touch();
    this.domainEvents.push({
      eventType: 'ReservationCancelled.v1',
      reservationId: this.props.id.toString(),
      cancelledBy: params.cancelledBy,
      penaltyApplied: penaltyAdjustment ? adjustmentPayload(penaltyAdjustment) : undefined,
    });
  }

  markNoShow(params: { penalty?: Money; penaltyReason?: string }): void {
    this.assertStatus('Confirmed', 'markNoShow');
    const penaltyAdjustment = this.registerPenaltyIfAny(params.penalty, params.penaltyReason);
    this.props.status = 'Cancelled';
    this.touch();
    this.domainEvents.push({
      eventType: 'NoShowRegistered.v1',
      reservationId: this.props.id.toString(),
      penaltyApplied: penaltyAdjustment ? adjustmentPayload(penaltyAdjustment) : undefined,
    });
  }

  checkOut(params: {
    odometer: Odometer;
    fuelLevel: FuelLevel;
    photoFileIds: string[];
    inspectedBy: string;
    isVehicleOperational: boolean;
    isBranchActive: boolean;
    branchId: string;
    areDriversValidated: boolean;
  }): InspectionId {
    this.assertStatus('Confirmed', 'checkOut');
    if (!params.isBranchActive) {
      throw new BranchClosedError(params.branchId);
    }
    if (!params.isVehicleOperational) {
      throw new VehicleNotAvailableError(this.props.vehicleId);
    }
    if (!params.areDriversValidated) {
      throw new DriverNotValidatedError(this.props.id.toString());
    }
    const inspection = Inspection.register({
      type: 'CheckOut',
      odometer: params.odometer,
      fuelLevel: params.fuelLevel,
      photoFileIds: params.photoFileIds,
      inspectedBy: params.inspectedBy,
    });
    this.inspections.push(inspection);
    this.dirtyInspectionIds.add(inspection.id.toString());
    this.props.status = 'CheckedOut';
    this.touch();
    this.domainEvents.push({
      eventType: 'ReservationCheckedOut.v1',
      reservationId: this.props.id.toString(),
      vehicleId: this.props.vehicleId,
      inspectionId: inspection.id.toString(),
      odometer: params.odometer.value,
    });
    return inspection.id;
  }

  checkIn(params: {
    odometer: Odometer;
    fuelLevel: FuelLevel;
    photoFileIds: string[];
    inspectedBy: string;
    isBranchActive: boolean;
    branchId: string;
    damages?: DamageInput[];
    adjustments?: {
      amount: Money;
      kind: 'LateReturnPenalty' | 'DamagePenalty' | 'FuelDifference';
      reason?: string;
    }[];
  }): InspectionId {
    this.assertStatus('CheckedOut', 'checkIn');
    if (!params.isBranchActive) {
      throw new BranchClosedError(params.branchId);
    }
    const checkOutInspection = this.inspections.find(
      (inspection) => inspection.type === 'CheckOut',
    );
    if (!checkOutInspection) {
      throw new InspectionRequiredError(this.props.id.toString(), 'CheckOut');
    }

    const inspection = Inspection.register({
      type: 'CheckIn',
      odometer: params.odometer,
      fuelLevel: params.fuelLevel,
      photoFileIds: params.photoFileIds,
      inspectedBy: params.inspectedBy,
    });
    this.inspections.push(inspection);
    this.dirtyInspectionIds.add(inspection.id.toString());

    for (const damageInput of params.damages ?? []) {
      const damageReport = DamageReport.register({
        inspectionId: inspection.id.toString(),
        description: damageInput.description,
        severity: damageInput.severity,
        imputableToCustomer: damageInput.imputableToCustomer,
        photoFileIds: damageInput.photoFileIds,
      });
      this.damageReports.push(damageReport);
      this.dirtyDamageReportIds.add(damageReport.id.toString());
    }

    for (const adjustmentInput of params.adjustments ?? []) {
      const adjustment = PriceAdjustment.create({
        kind: adjustmentInput.kind,
        amount: adjustmentInput.amount,
        reason: adjustmentInput.reason,
      });
      this.priceAdjustments.push(adjustment);
      this.dirtyPriceAdjustmentIds.add(adjustment.id.toString());
    }

    this.props.status = 'CheckedIn';
    this.touch();
    this.domainEvents.push({
      eventType: 'ReservationCheckedIn.v1',
      reservationId: this.props.id.toString(),
      customerId: this.props.customerId,
      vehicleId: this.props.vehicleId,
      inspectionId: inspection.id.toString(),
      priceBreakdown: this.priceBreakdownPayload(),
    });
    return inspection.id;
  }

  reschedule(params: {
    newRange: DateRange;
    newBaseAmount: Money;
    isNewRangeAvailable: boolean;
  }): void {
    if (this.props.status !== 'Draft' && this.props.status !== 'Confirmed') {
      throw new ReservationInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'reschedule',
      );
    }
    if (!params.isNewRangeAvailable) {
      throw new VehicleNotAvailableError(this.props.vehicleId);
    }
    const previousRange = this.props.dateRange;
    this.props.dateRange = params.newRange;
    this.props.baseAmount = params.newBaseAmount;
    this.touch();
    this.domainEvents.push({
      eventType: 'ReservationRescheduled.v1',
      reservationId: this.props.id.toString(),
      previousRange: rangePayload(previousRange),
      newRange: rangePayload(params.newRange),
      priceBreakdown: this.priceBreakdownPayload(),
    });
  }

  // Auto-transicion (docs/model/08-STATE_MACHINES.md SS1.2) - no cambia ReservationStatus,
  // no reemplaza el DateRange (eso lo hace approveExtension()). Bumpea version igual porque
  // el evento necesita asociarse a una escritura real (ver plan de implementacion).
  requestExtension(params: { requestedNewEndDate: Date }): void {
    this.assertStatus('CheckedOut', 'requestExtension');
    this.touch();
    this.domainEvents.push({
      eventType: 'ExtensionRequested.v1',
      reservationId: this.props.id.toString(),
      requestedNewEndDate: params.requestedNewEndDate.toISOString(),
    });
  }

  approveExtension(params: {
    newEndDate: Date;
    adjustmentAmount: Money;
    isNewRangeAvailable: boolean;
  }): void {
    this.assertStatus('CheckedOut', 'approveExtension');
    if (!params.isNewRangeAvailable) {
      throw new ExtensionCollidesError(this.props.id.toString());
    }
    const newRange = DateRange.from(this.props.dateRange.start, params.newEndDate);
    const adjustment = PriceAdjustment.create({
      kind: 'Extension',
      amount: params.adjustmentAmount,
    });
    this.priceAdjustments.push(adjustment);
    this.dirtyPriceAdjustmentIds.add(adjustment.id.toString());
    this.props.dateRange = newRange;
    this.touch();
    this.domainEvents.push({
      eventType: 'ExtensionApproved.v1',
      reservationId: this.props.id.toString(),
      newRange: rangePayload(newRange),
      priceBreakdown: this.priceBreakdownPayload(),
    });
  }

  swapVehicle(params: {
    newVehicleId: string;
    reason?: string;
    isNewVehicleAvailable: boolean;
  }): void {
    this.assertStatus('CheckedOut', 'swapVehicle');
    if (!params.isNewVehicleAvailable) {
      throw new VehicleNotAvailableError(params.newVehicleId);
    }
    const previousVehicleId = this.props.vehicleId;
    this.props.vehicleId = params.newVehicleId;
    this.touch();
    this.domainEvents.push({
      eventType: 'VehicleSwapped.v1',
      reservationId: this.props.id.toString(),
      previousVehicleId,
      newVehicleId: params.newVehicleId,
      reason: params.reason,
    });
  }

  close(params: { hasInvoiceIssued: boolean }): void {
    this.assertStatus('CheckedIn', 'close');
    if (!params.hasInvoiceIssued) {
      throw new InvoiceNotYetIssuedError(this.props.id.toString());
    }
    this.props.status = 'Closed';
    this.touch();
    this.domainEvents.push({
      eventType: 'ReservationClosed.v1',
      reservationId: this.props.id.toString(),
    });
  }

  pullDomainEvents(): ReservationDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }

  pullDirtyInspections(): Inspection[] {
    const dirty = this.inspections.filter((inspection) =>
      this.dirtyInspectionIds.has(inspection.id.toString()),
    );
    this.dirtyInspectionIds.clear();
    return dirty;
  }

  pullDirtyDamageReports(): DamageReport[] {
    const dirty = this.damageReports.filter((report) =>
      this.dirtyDamageReportIds.has(report.id.toString()),
    );
    this.dirtyDamageReportIds.clear();
    return dirty;
  }

  pullDirtyPriceAdjustments(): PriceAdjustment[] {
    const dirty = this.priceAdjustments.filter((adjustment) =>
      this.dirtyPriceAdjustmentIds.has(adjustment.id.toString()),
    );
    this.dirtyPriceAdjustmentIds.clear();
    return dirty;
  }

  private assertStatus(expected: ReservationStatusValue, action: string): void {
    if (this.props.status !== expected) {
      throw new ReservationInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        action,
      );
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  private registerPenaltyIfAny(penalty?: Money, reason?: string): PriceAdjustment | undefined {
    if (!penalty) {
      return undefined;
    }
    const adjustment = PriceAdjustment.create({
      kind: 'CancellationPenalty',
      amount: penalty,
      reason,
    });
    this.priceAdjustments.push(adjustment);
    this.dirtyPriceAdjustmentIds.add(adjustment.id.toString());
    return adjustment;
  }

  private priceBreakdownPayload(): PriceBreakdownPayload {
    return {
      baseAmountMinorUnits: this.props.baseAmount.minorUnits,
      currency: this.props.baseAmount.currencyCode,
      adjustments: this.priceAdjustments.map(adjustmentPayload),
    };
  }
}

function rangePayload(range: DateRange): { startDate: string; endDate: string } {
  return { startDate: range.start.toISOString(), endDate: range.end.toISOString() };
}

function adjustmentPayload(adjustment: PriceAdjustment) {
  return {
    kind: adjustment.kind,
    amountMinorUnits: adjustment.amount.minorUnits,
    currency: adjustment.amount.currencyCode,
    reason: adjustment.reason,
  };
}
