import type { AuditLogEntry } from '@platform/audit/domain';

export const AUDIT_LOG_REPOSITORY = Symbol('AuditLogRepository');

// Solo `save` - AuditLogEntry es append-only (INV-024), nunca se busca por id ni se
// actualiza desde este puerto. La lectura para GET /audit-log pasa por ReadTransaction
// directo en infrastructure/queries (CQRS selectivo, ADR-0007), no por este repositorio.
export interface AuditLogRepository {
  save(entry: AuditLogEntry): Promise<void>;
}
