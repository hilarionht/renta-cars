import { Injectable } from '@nestjs/common';

import { PERMISSION_CATALOG } from '@platform/roles-permissions/domain';
import type { PermissionSummary } from '@platform/roles-permissions/application';

// Catalogo de codigo (PERMISSION_CATALOG), no requiere DB - no usa ReadTransaction porque
// no hay tenant a filtrar (docs/persistence/07-MIGRACIONES.md SS5.1: el catalogo mismo no
// es una tabla).
@Injectable()
export class ListPermissionsHandler {
  execute(): PermissionSummary[] {
    return PERMISSION_CATALOG.map((key) => ({ key }));
  }
}
