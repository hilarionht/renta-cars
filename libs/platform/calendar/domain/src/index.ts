// Superficie publica de "platform-calendar-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export {
  AvailabilitySlot,
  type AvailabilitySlotId,
  type AvailabilitySlotProps,
} from './entities/availability-slot';
export { ResourceRef } from './value-objects/resource-ref';
export type { SlotKindValue } from './value-objects/slot-kind';
export type { SlotStatusValue } from './value-objects/slot-status';
export { AvailabilitySlotNotFoundError } from './errors/availability-slot-not-found.error';
export { AvailabilitySlotOverlapError } from './errors/availability-slot-overlap.error';
export type { AvailabilitySlotCreatedEvent } from './events/availability-slot-created.event';
export type { AvailabilitySlotReleasedEvent } from './events/availability-slot-released.event';
