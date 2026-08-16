export interface RecordAuditLogEntryCommand {
  companyId: string | null;
  actorRef: string;
  action: string;
  subjectType: string;
  subjectId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}
