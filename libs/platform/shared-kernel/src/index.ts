// Superficie publica de "platform-shared-kernel". Exporta explicitamente cada simbolo -
// prohibido `export *` (docs/technical/09-CODING-STANDARDS.md SS2).
export { DomainError } from './errors/domain-error';
export { EntityId } from './value-objects/entity-id';
export { Email } from './value-objects/email';
export type { UnitOfWork, UnitOfWorkTransaction } from './ports/unit-of-work';
