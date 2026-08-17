// Superficie publica de "platform-shared-kernel". Exporta explicitamente cada simbolo -
// prohibido `export *` (docs/technical/09-CODING-STANDARDS.md SS2).
export { DomainError } from './errors/domain-error';
export { ConcurrentModificationError } from './errors/concurrent-modification.error';
export type {
  DomainErrorConstructor,
  DomainErrorEntries,
  DomainErrorMapping,
} from './errors/domain-error-registry-types';
export { EntityId } from './value-objects/entity-id';
export { Email } from './value-objects/email';
export { PhoneNumber } from './value-objects/phone-number';
export { UNIT_OF_WORK } from './ports/unit-of-work';
export type { UnitOfWork, UnitOfWorkTransaction } from './ports/unit-of-work';
export { DOMAIN_EVENT_PUBLISHER } from './ports/domain-event-publisher';
export type {
  DomainEventPublisher,
  DomainEventToPublish,
  DomainEventEmitted,
} from './ports/domain-event-publisher';
export { COMPANY_EXISTS_PORT } from './ports/company-exists.port';
export type { CompanyExistsPort } from './ports/company-exists.port';
