import { Inject, Injectable } from '@nestjs/common';

import { Action, ActorRef, AuditLogEntry, Subject } from '@platform/audit/domain';

import { AUDIT_LOG_REPOSITORY, type AuditLogRepository } from '../../ports/audit-log.repository';
import type { RecordAuditLogEntryCommand } from './record-audit-log-entry.command';

// Invocado exclusivamente por DomainEventAuditListener (infrastructure) - nunca expuesto via
// HTTP, ningun usuario "crea" una fila de auditoria directamente.
@Injectable()
export class RecordAuditLogEntryHandler {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(command: RecordAuditLogEntryCommand): Promise<void> {
    const entry = AuditLogEntry.create({
      companyId: command.companyId,
      actorRef: ActorRef.from(command.actorRef),
      action: Action.from(command.action),
      subject: Subject.from({ subjectType: command.subjectType, subjectId: command.subjectId }),
      payload: command.payload,
      occurredAt: command.occurredAt,
    });

    await this.auditLogRepository.save(entry);
  }
}
