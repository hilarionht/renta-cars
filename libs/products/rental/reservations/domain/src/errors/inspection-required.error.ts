import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md - INSPECTION_REQUIRED (422, INV-003/RN-13,
// INV-004/RN-14) - checkOut()/checkIn() sin datos de inspeccion completos.
export class InspectionRequiredError extends DomainError {
  constructor(reservationId: string, type: string) {
    super(`La reservation "${reservationId}" requiere una Inspection de tipo "${type}" completa.`);
  }
}
