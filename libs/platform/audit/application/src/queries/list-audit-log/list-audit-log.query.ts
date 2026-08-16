export interface ListAuditLogQuery {
  companyId: string;
  subjectType?: string;
  subjectId?: string;
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
