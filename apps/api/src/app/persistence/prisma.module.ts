import { Global, Module } from '@nestjs/common';

import { RequestContext } from '../context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { tenantScopeExtension } from './tenant-scope.extension';
import { TENANT_SCOPED_PRISMA } from './tenant-scoped-prisma.token';

// Modulo global (docs/technical/03-BACKEND-ARCHITECTURE.md SS3: "nunca reimportado por
// modulo") - antes de este cambio PrismaService solo vivia dentro de HealthModule, sin
// forma de inyectarlo en los modulos de Identity & Access. Un unico PrismaClient para toda
// la app (docs/technical/04-PERSISTENCE.md SS1). El cliente extendido con tenant-scope se
// expone bajo un token separado (TENANT_SCOPED_PRISMA) - $extends() devuelve un tipo
// distinto al de PrismaService, no se puede reemplazar la clase base sin romper el uso ya
// existente de PrismaService en HealthController.
@Global()
@Module({
  providers: [
    PrismaService,
    RequestContext,
    {
      provide: TENANT_SCOPED_PRISMA,
      useFactory: (prisma: PrismaService, requestContext: RequestContext) =>
        prisma.$extends(tenantScopeExtension(requestContext)),
      inject: [PrismaService, RequestContext],
    },
  ],
  exports: [PrismaService, RequestContext, TENANT_SCOPED_PRISMA],
})
export class PrismaModule {}
