// Superficie publica de "platform-audit-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { AUDIT_LOG_REPOSITORY, type AuditLogRepository } from './ports/audit-log.repository';
export { RecordAuditLogEntryHandler } from './commands/record-audit-log-entry/record-audit-log-entry.handler';
export type { RecordAuditLogEntryCommand } from './commands/record-audit-log-entry/record-audit-log-entry.command';
export type {
  ListAuditLogQuery,
  AuditLogSummary,
} from './queries/list-audit-log/list-audit-log.query';
