import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - CUSTOMER_NOT_ELIGIBLE (422, INV-104/RN-08).
export class CustomerNotEligibleError extends DomainError {
  constructor(customerId: string) {
    super(`El customer "${customerId}" no es elegible para confirmar la reservation.`);
  }
}
