import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - PAYMENT_ALREADY_PROCESSED (409, INV-021) - reintento
// de una operacion de cobro con IdempotencyKey ya procesada. Lanzado desde infrastructure/
// al capturar la violacion de UNIQUE(company_id, idempotency_key), mismo patron que
// DuplicateVehicleLicensePlateError en Vehicles.
export class PaymentAlreadyProcessedError extends DomainError {
  constructor(idempotencyKey: string) {
    super(`Ya existe un payment procesado con la idempotency key "${idempotencyKey}".`);
  }
}
