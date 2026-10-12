import type { DomainErrorEntries } from '@platform/shared-kernel';

// Vacio a proposito - AuditLogEntry no tiene errores de dominio propios (no interpreta ni
// valida el contenido de negocio del evento que registra, docs/model/02-AGGREGATES.md §17).
export const AUDIT_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [];
