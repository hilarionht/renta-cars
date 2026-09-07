import { DomainError } from '@platform/shared-kernel';

// docs/contracts/07-ERROR-CATALOG.md SS3 (gap encontrado en esta tanda, agregado al
// catalogo junto con este codigo - ver docs actualizados): email desconocido o contrasena
// incorrecta. Nunca distingue cual de las dos al cliente (mismo mensaje/codigo para ambos
// casos, mitiga enumeracion de usuarios).
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Credenciales invalidas.');
  }
}
