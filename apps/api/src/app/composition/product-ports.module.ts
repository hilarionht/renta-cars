import { Global, Module } from '@nestjs/common';

import { BRANCH_ACTIVE_RESERVATIONS_PORT } from '@platform/branches/application';
import { PrismaBranchActiveReservationsAdapter } from '@rental/reservations/infrastructure';

// docs/persistence/10-DECISIONES.md #140: raiz de composicion para los puertos que define
// platform y implementa un producto. platform no puede importar rental (INV-P03, docs/technical/
// 01-MONOREPO.md); apps/api si. Global para que BranchesModule (singleton estatico compartido)
// vea el token; su unica dependencia (ReadTransaction) ya es global via PrismaModule.
@Global()
@Module({
  providers: [
    { provide: BRANCH_ACTIVE_RESERVATIONS_PORT, useClass: PrismaBranchActiveReservationsAdapter },
  ],
  exports: [BRANCH_ACTIVE_RESERVATIONS_PORT],
})
export class ProductPortsModule {}
