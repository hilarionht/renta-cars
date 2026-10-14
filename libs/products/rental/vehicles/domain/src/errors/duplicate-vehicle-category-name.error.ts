import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #137: antes el P2002 de vehicle_categories_company_id_name_key
// llegaba sin mapear y respondia 500 (auditoria en vivo de Flota).
export class DuplicateVehicleCategoryNameError extends DomainError {
  constructor(name: string) {
    super(`Ya existe una categoria de vehiculo llamada "${name}" en esta company.`);
  }
}
