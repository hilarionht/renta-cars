import { Module } from '@nestjs/common';

import { AUDIT_LOG_REPOSITORY, RecordAuditLogEntryHandler } from '@platform/audit/application';

import { PrismaAuditLogRepository } from './persistence/prisma/prisma-audit-log.repository';
import { DomainEventAuditListener } from './events/domain-event-audit.listener';
import { AuditLogController } from './http/audit-log.controller';
import { ListAuditLogHandler } from './queries/list-audit-log.handler';

// No exporta nada cross-modulo - nadie mas necesita leer AuditLogEntry todavia.
@Module({
  controllers: [AuditLogController],
  providers: [
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    RecordAuditLogEntryHandler,
    ListAuditLogHandler,
    DomainEventAuditListener,
  ],
})
export class AuditModule {}
