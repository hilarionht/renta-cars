import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  BranchClosedError,
  CustomerNotEligibleError,
  DriverNotValidatedError,
  ExtensionCollidesError,
  InspectionRequiredError,
  InvoiceNotYetIssuedError,
  NoActiveRateError,
  ReservationInvalidStateTransitionError,
  ReservationNotFoundError,
  ReservationOverlapError,
  VehicleNotAvailableError,
} from '@rental/reservations/domain';

// docs/contracts/07-ERROR-CATALOG.md - mapeo code/status ya reservado, activado en esta
// tanda (primer consumidor real de Reservations).
export const RESERVATIONS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    ReservationInvalidStateTransitionError,
    { status: 409, code: 'INVALID_STATE_TRANSITION', title: 'Transicion de estado invalida' },
  ],
  [
    ReservationOverlapError,
    {
      status: 409,
      code: 'RESERVATION_OVERLAP',
      title: 'El vehicle ya tiene una reservation activa que se solapa',
    },
  ],
  [
    VehicleNotAvailableError,
    { status: 409, code: 'VEHICLE_NOT_AVAILABLE', title: 'El vehicle no esta disponible' },
  ],
  [
    CustomerNotEligibleError,
    { status: 422, code: 'CUSTOMER_NOT_ELIGIBLE', title: 'El customer no es elegible' },
  ],
  [
    DriverNotValidatedError,
    { status: 422, code: 'DRIVER_NOT_VALIDATED', title: 'Un additional driver no esta Validated' },
  ],
  [
    InspectionRequiredError,
    { status: 422, code: 'INSPECTION_REQUIRED', title: 'Se requiere una Inspection completa' },
  ],
  [
    InvoiceNotYetIssuedError,
    {
      status: 409,
      code: 'INVOICE_NOT_YET_ISSUED',
      title: 'La reservation no tiene una Invoice emitida',
    },
  ],
  [
    ExtensionCollidesError,
    {
      status: 409,
      code: 'EXTENSION_COLLIDES',
      title: 'La extension solicitada colisiona con otra reservation',
    },
  ],
  [BranchClosedError, { status: 409, code: 'BRANCH_CLOSED', title: 'La branch esta cerrada' }],
  [
    ReservationNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Reservation no encontrada' },
  ],
  [
    NoActiveRateError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'No hay ninguna Rate vigente' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
