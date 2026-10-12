// Superficie publica de "platform-calendar-infrastructure".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { CalendarModule } from './calendar.module';
export { CALENDAR_DOMAIN_ERROR_ENTRIES } from './errors/calendar-domain-error.registry';
