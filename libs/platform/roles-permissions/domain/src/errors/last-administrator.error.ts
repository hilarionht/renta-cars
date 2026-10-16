import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #140 (decision del usuario): la company siempre conserva al
// menos un usuario activo que puede administrar usuarios y roles. Sin esto, el unico admin podia
// quitarse el rol o deshabilitarse y no habia forma de recuperar la company por API.
export class LastAdministratorError extends DomainError {
  constructor() {
    super(
      'La operacion dejaria a la empresa sin ningun usuario activo que pueda administrar usuarios y roles.',
    );
  }
}
