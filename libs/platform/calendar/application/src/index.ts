// Superficie publica de "platform-calendar-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export {
  AVAILABILITY_SLOT_REPOSITORY,
  type AvailabilitySlotRepository,
} from './ports/availability-slot.repository';
export { CALENDAR_PORT, type CalendarPort, type OccupySlotParams } from './ports/calendar.port';

export { OccupySlotHandler } from './commands/occupy-slot/occupy-slot.handler';
export type { OccupySlotCommand } from './commands/occupy-slot/occupy-slot.command';
export { ReleaseSlotHandler } from './commands/release-slot/release-slot.handler';
export type { ReleaseSlotCommand } from './commands/release-slot/release-slot.command';

export type {
  CheckAvailabilityQuery,
  CheckAvailabilityResult,
} from './queries/check-availability/check-availability.query';
