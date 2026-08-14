import { Global, Module } from '@nestjs/common';

import { DOMAIN_EVENT_PUBLISHER, UNIT_OF_WORK } from '@platform/shared-kernel';
import {
  OutboxWriter,
  PrismaService,
  PrismaUnitOfWork,
  ReadTransaction,
  RequestContext,
  TENANT_SCOPED_PRISMA,
  tenantScopeExtension,
} from '@platform/persistence-kernel';

// Modulo global (docs/technical/03-BACKEND-ARCHITECTURE.md SS3: "nunca reimportado por
// modulo") - la infraestructura de Prisma en si (PrismaService, extension de tenant-scope,
// UnitOfWork, ReadTransaction, OutboxWriter, RequestContext) vive en
// libs/platform/persistence-kernel (libs/ nunca puede importar apps/, tooling/eslint/
// boundaries.mjs) - este modulo solo hace el binding de esas clases/puertos dentro de la
// raiz de composicion de apps/api.
//
// UNIT_OF_WORK/DOMAIN_EVENT_PUBLISHER (puertos de shared-kernel) se bindean una unica vez
// aca - infraestructura generica de toda la app, no de un modulo de negocio especifico;
// cada modulo (identity/users/roles-permissions) los inyecta por token en su propio
// <modulo>.module.ts, nunca importa PrismaUnitOfWork/OutboxWriter directamente.
@Global()
@Module({
  providers: [
    PrismaService,
    RequestContext,
    ReadTransaction,
    {
      provide: TENANT_SCOPED_PRISMA,
      useFactory: (prisma: PrismaService, requestContext: RequestContext) =>
        prisma.$extends(tenantScopeExtension(requestContext)),
      inject: [PrismaService, RequestContext],
    },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: DOMAIN_EVENT_PUBLISHER, useClass: OutboxWriter },
  ],
  exports: [
    PrismaService,
    RequestContext,
    ReadTransaction,
    TENANT_SCOPED_PRISMA,
    UNIT_OF_WORK,
    DOMAIN_EVENT_PUBLISHER,
  ],
})
export class PrismaModule {}
