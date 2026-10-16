import { Controller, Get, Query } from '@nestjs/common';

import { RequestContext, RequirePermission } from '@platform/persistence-kernel';

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
  @RequirePermission('audit:read')
  async list(@Query() dto: ListAuditLogRequestDto): Promise<{
    data: AuditLogEntryResponseDto[];
    meta: { nextCursor: string | null; limit: number };
  }> {
    const { companyId } = this.requestContext.get();
    const result = await this.listAuditLog.execute({
      companyId,
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      cursor: dto.cursor,
      limit: dto.limit,
    });
    // #140: mismo envelope paginado que GET /users y /reservations.
    return { data: result.items, meta: { nextCursor: result.nextCursor, limit: result.limit } };
  }
}
