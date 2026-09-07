// Superficie publica de "platform-branches-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { Branch, type BranchId, type BranchProps } from './entities/branch';
export { BranchName } from './value-objects/branch-name';
export { Address, type AddressProps } from './value-objects/address';
export {
  OperatingHours,
  type DaySchedule,
  type Weekday,
  WEEKDAYS,
} from './value-objects/operating-hours';
export type { BranchStatus } from './value-objects/branch-status';
export { BranchNotFoundError } from './errors/branch-not-found.error';
export type { BranchOpenedEvent } from './events/branch-opened.event';
export type { BranchClosedEvent } from './events/branch-closed.event';
