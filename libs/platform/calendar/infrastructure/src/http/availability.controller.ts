import { Controller, Get, Query } from '@nestjs/common';

import { RequestContext } from '@platform/persistence-kernel';

import { CheckAvailabilityHandler } from '../queries/check-availability.handler';
import { CheckAvailabilityRequestDto } from './dto/check-availability-request.dto';
import type { CheckAvailabilityResponseDto } from './dto/check-availability-response.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS3: "availability" es publico, de solo consulta
// agregada - AvailabilitySlot NUNCA es un recurso CRUD directo ("Reglas de modificacion:
// solo a traves del puerto CalendarPort", docs/model/02-AGGREGATES.md SS7). Unico endpoint
// de este modulo - sin POST/PATCH/DELETE. Sin @RequiresProductModule() - Calendar es
// scope:platform, no gateado por EnabledProductModules (mismo criterio que Files/Settings).
@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly checkAvailability: CheckAvailabilityHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get()
  async check(@Query() dto: CheckAvailabilityRequestDto): Promise<CheckAvailabilityResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.checkAvailability.execute({
      companyId,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }
}
