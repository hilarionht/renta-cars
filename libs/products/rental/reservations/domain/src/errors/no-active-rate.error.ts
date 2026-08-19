import { DomainError } from '@platform/shared-kernel';

// Gap-fill: ninguna Rate vigente para la VehicleCategory al momento de calcular el precio
// (RN-20) - caso limite no cubierto explicitamente por docs/contracts/07-ERROR-CATALOG.md,
// mapeado a RESOURCE_NOT_FOUND (404) por PricingService, mismo criterio generico que el
// resto de los *NotFoundError de este modelo.
export class NoActiveRateError extends DomainError {
  constructor(vehicleCategoryId: string) {
    super(`La vehicle category "${vehicleCategoryId}" no tiene ninguna Rate vigente.`);
  }
}
