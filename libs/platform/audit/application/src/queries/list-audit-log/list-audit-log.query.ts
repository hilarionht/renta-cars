// docs/persistence/10-DECISIONES.md #140: paginado por cursor (orden de registro: id v7 desc) y
// filtro por fecha del evento.
export interface ListAuditLogQuery {
  companyId: string;
  subjectType?: string;
  subjectId?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
}

export interface ListAuditLogResult {
  items: AuditLogSummary[];
  nextCursor: string | null;
  limit: number;
}

export interface AuditLogSummary {
  id: string;
  actorRef: string;
  action: string;
  subjectType: string;
  subjectId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}
