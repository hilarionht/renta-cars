import { Controller, Get } from '@nestjs/common';

import { ListPermissionsHandler } from '../queries/list-permissions.handler';
import type { PermissionResponseDto } from './dto/permission-response.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS1: "permissions" es publico, solo lectura (el
// catalogo de codigo, nunca editable via API).
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly listPermissions: ListPermissionsHandler) {}

  @Get()
  list(): PermissionResponseDto[] {
    return this.listPermissions.execute();
  }
}
