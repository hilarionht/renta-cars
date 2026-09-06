import { DomainError } from './domain-error';

// Reutilizable por cualquier endpoint que soporte `?expand=<relacion>` (docs/contracts/
// 10-DECISIONES.md #3, 03-REQUEST-RESPONSE-STANDARDS.md SS2.2, 07-ERROR-CATALOG.md
// UNSUPPORTED_EXPAND) - mismo criterio que ConcurrentModificationError: un mecanismo de
// contrato HTTP puro, con semantica identica en cualquier modulo que lo use, se comparte
// desde shared-kernel y cada modulo registra su propio mapeo de status/code.
export class UnsupportedExpandError extends DomainError {
  constructor(value: string, allowed: string[]) {
    super(`expand="${value}" no esta soportado. Valores permitidos: ${allowed.join(', ')}.`);
  }
}
