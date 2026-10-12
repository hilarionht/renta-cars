export class AuditLogEntryResponseDto {
  id!: string;
  actorRef!: string;
  action!: string;
  subjectType!: string;
  subjectId!: string;
  payload!: Record<string, unknown>;
  occurredAt!: Date;
}
