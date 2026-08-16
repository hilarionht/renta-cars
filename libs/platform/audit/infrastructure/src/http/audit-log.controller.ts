import { Controller, Get, Query } from '@nestjs/common';

import { RequestContext } from '@platform/persistence-kernel';

import { ListAuditLogHandler } from '../queries/list-audit-log.handler';
import type { AuditLogEntryResponseDto } from './dto/audit-log-entry-response.dto';
import { ListAuditLogRequestDto } from './dto/list-audit-log-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md: "audit-log" es "Interno, solo lectura" - sin
// POST/PATCH/DELETE expuestos (INV-024 tambien a nivel de superficie HTTP, no solo en el
// dominio y en los permisos de Postgres).
@Controller('audit-log')
export class AuditLogController {
  constructor(
    private readonly listAuditLog: ListAuditLogHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get()
  async list(@Query() dto: ListAuditLogRequestDto): Promise<AuditLogEntryResponseDto[]> {
    const { companyId } = this.requestContext.get();
    return this.listAuditLog.execute({
      companyId,
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
    });
  }
}
