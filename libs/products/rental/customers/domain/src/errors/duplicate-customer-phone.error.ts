import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #139: el telefono identifica al customer en el login por
// codigo de WhatsApp; si dos lo compartian, el login entraba siempre al primero.
export class DuplicateCustomerPhoneError extends DomainError {
  constructor(phone: string) {
    super(`Ya existe un customer con el telefono "${phone}" en esta company.`);
  }
}
