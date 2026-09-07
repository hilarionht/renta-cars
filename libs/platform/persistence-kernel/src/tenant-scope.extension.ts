import { Prisma } from '@prisma/client';

import type { RequestContext } from './request-context';

// Segunda capa de defensa multi-tenant (ADR-0004): ademas de RLS a nivel de Postgres, todo
// modelo con `companyId` se filtra tambien a nivel de aplicacion via Prisma Client
// Extension - "un desarrollador no puede omitirlo porque no escribe el filtro a mano"
// (docs/technical/03-BACKEND-ARCHITECTURE.md SS9). Solo cubre lecturas (findMany/findFirst/
// count/aggregate); las escrituras van siempre por PrismaUnitOfWork + SET LOCAL, que es la
// capa que de verdad hace cumplir el aislamiento en escritura (RLS lo refuerza).
const MODELS_WITH_COMPANY_ID = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'companyId'))
    .map((model) => model.name),
);

const READ_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
]);

export function tenantScopeExtension(requestContext: RequestContext) {
  return Prisma.defineExtension({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELS_WITH_COMPANY_ID.has(model) || !READ_OPERATIONS.has(operation)) {
            return query(args);
          }

          const context = requestContext.tryGet();
          if (!context) {
            return query(args);
          }

          const scopedArgs = args as { where?: Record<string, unknown> };
          scopedArgs.where = { ...scopedArgs.where, companyId: context.companyId };
          return query(scopedArgs);
        },
      },
    },
  });
}
