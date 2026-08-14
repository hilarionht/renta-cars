import { DomainError } from './domain-error';

// Reutilizable por cualquier modulo con control de concurrencia optimista (columna
// `version`) - docs/contracts/07-ERROR-CATALOG.md, CONCURRENT_MODIFICATION (409). Un
// UPDATE cuyo WHERE incluye la version esperada y afecta 0 filas dispara esto.
export class ConcurrentModificationError extends DomainError {
  constructor(aggregateType: string, id: string) {
    super(`"${aggregateType}" "${id}" fue modificado por otra operacion concurrente.`);
  }
}
