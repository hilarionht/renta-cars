// Superficie publica de "rental-reservations-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { RESERVATION_REPOSITORY, type ReservationRepository } from './ports/reservation.repository';

export { AvailabilityService } from './services/availability.service';
export { PricingService } from './services/pricing.service';

export { CreateReservationHandler } from './commands/create-reservation/create-reservation.handler';
export type { CreateReservationCommand } from './commands/create-reservation/create-reservation.command';
export { ConfirmReservationHandler } from './commands/confirm-reservation/confirm-reservation.handler';
export type { ConfirmReservationCommand } from './commands/confirm-reservation/confirm-reservation.command';
export { CancelReservationHandler } from './commands/cancel-reservation/cancel-reservation.handler';
export type { CancelReservationCommand } from './commands/cancel-reservation/cancel-reservation.command';
export { MarkNoShowHandler } from './commands/mark-no-show/mark-no-show.handler';
export type { MarkNoShowCommand } from './commands/mark-no-show/mark-no-show.command';
export { CheckOutReservationHandler } from './commands/check-out-reservation/check-out-reservation.handler';
export type { CheckOutReservationCommand } from './commands/check-out-reservation/check-out-reservation.command';
export { CheckInReservationHandler } from './commands/check-in-reservation/check-in-reservation.handler';
export type {
  CheckInReservationCommand,
  CheckInDamageInput,
} from './commands/check-in-reservation/check-in-reservation.command';
export { RescheduleReservationHandler } from './commands/reschedule-reservation/reschedule-reservation.handler';
export type { RescheduleReservationCommand } from './commands/reschedule-reservation/reschedule-reservation.command';
export { RequestExtensionHandler } from './commands/request-extension/request-extension.handler';
export type { RequestExtensionCommand } from './commands/request-extension/request-extension.command';
export { ApproveExtensionHandler } from './commands/approve-extension/approve-extension.handler';
export type { ApproveExtensionCommand } from './commands/approve-extension/approve-extension.command';
export { SwapVehicleHandler } from './commands/swap-vehicle/swap-vehicle.handler';
export type { SwapVehicleCommand } from './commands/swap-vehicle/swap-vehicle.command';
export { CloseReservationHandler } from './commands/close-reservation/close-reservation.handler';
export type { CloseReservationCommand } from './commands/close-reservation/close-reservation.command';

export type {
  GetReservationQuery,
  ReservationSummary,
} from './queries/get-reservation/get-reservation.query';
export type {
  ListReservationsQuery,
  ListReservationsResult,
} from './queries/list-reservations/list-reservations.query';
