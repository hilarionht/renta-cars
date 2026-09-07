// Superficie publica de "rental-reservations-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Reservation, type ReservationProps, type ReservationId } from './entities/reservation';
export { Inspection, type InspectionProps, type InspectionId } from './entities/inspection';
export {
  DamageReport,
  type DamageReportProps,
  type DamageReportId,
} from './entities/damage-report';
export {
  PriceAdjustment,
  type PriceAdjustmentProps,
  type PriceAdjustmentId,
} from './entities/price-adjustment';

export type { ReservationStatusValue } from './value-objects/reservation-status';
export type { PriceAdjustmentKindValue } from './value-objects/price-adjustment-kind';
export type { InspectionTypeValue } from './value-objects/inspection-type';
export type { DamageSeverityValue } from './value-objects/damage-severity';
export { Odometer } from './value-objects/odometer';
export { FuelLevel } from './value-objects/fuel-level';

export { ReservationNotFoundError } from './errors/reservation-not-found.error';
export { ReservationInvalidStateTransitionError } from './errors/reservation-invalid-state-transition.error';
export { VehicleNotAvailableError } from './errors/vehicle-not-available.error';
export { ReservationOverlapError } from './errors/reservation-overlap.error';
export { CustomerNotEligibleError } from './errors/customer-not-eligible.error';
export { DriverNotValidatedError } from './errors/driver-not-validated.error';
export { InspectionRequiredError } from './errors/inspection-required.error';
export { InvoiceNotYetIssuedError } from './errors/invoice-not-yet-issued.error';
export { ExtensionCollidesError } from './errors/extension-collides.error';
export { BranchClosedError } from './errors/branch-closed.error';
export { NoActiveRateError } from './errors/no-active-rate.error';

export type { ReservationCreatedEvent } from './events/reservation-created.event';
export type { ReservationConfirmedEvent } from './events/reservation-confirmed.event';
export type { ReservationRejectedByAvailabilityEvent } from './events/reservation-rejected-by-availability.event';
export type { ReservationCancelledEvent } from './events/reservation-cancelled.event';
export type { ReservationCheckedOutEvent } from './events/reservation-checked-out.event';
export type { ReservationRescheduledEvent } from './events/reservation-rescheduled.event';
export type { ExtensionRequestedEvent } from './events/extension-requested.event';
export type { ExtensionApprovedEvent } from './events/extension-approved.event';
export type { VehicleSwappedEvent } from './events/vehicle-swapped.event';
export type { ReservationCheckedInEvent } from './events/reservation-checked-in.event';
export type { NoShowRegisteredEvent } from './events/no-show-registered.event';
export type { ReservationClosedEvent } from './events/reservation-closed.event';
export type {
  PriceBreakdownPayload,
  PriceAdjustmentPayload,
} from './events/price-breakdown-payload';
