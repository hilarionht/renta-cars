import { Module } from '@nestjs/common';

import { AUDIT_LOG_REPOSITORY, RecordAuditLogEntryHandler } from '@platform/audit/application';

import { PrismaAuditLogRepository } from './persistence/prisma/prisma-audit-log.repository';
import { DomainEventAuditListener } from './events/domain-event-audit.listener';
import { AuditLogController } from './http/audit-log.controller';
import { ListAuditLogHandler } from './queries/list-audit-log.handler';

// RecordAuditLogEntryHandler exportado (docs/persistence/10-DECISIONES.md #121) -
// ReservationReminderScanProcessor lo llama directo para auditar cada uso del bypass
// platform_admin/BYPASSRLS (06-RLS.md §5: "registrado con maxima prioridad en
// AuditLogEntry") - primer consumidor cross-modulo real, antes "invocado exclusivamente
// por DomainEventAuditListener".
@Module({
  controllers: [AuditLogController],
  providers: [
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    RecordAuditLogEntryHandler,
    ListAuditLogHandler,
    DomainEventAuditListener,
  ],
  exports: [RecordAuditLogEntryHandler],
})
export class AuditModule {}
