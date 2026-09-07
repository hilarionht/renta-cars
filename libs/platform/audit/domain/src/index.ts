// Superficie publica de "platform-audit-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export {
  AuditLogEntry,
  type AuditLogEntryId,
  type AuditLogEntryProps,
} from './entities/audit-log-entry';
export { ActorRef } from './value-objects/actor-ref';
export { Action } from './value-objects/action';
export { Subject } from './value-objects/subject';
