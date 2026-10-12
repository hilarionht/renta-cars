import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS9: la unica fuente que un repositorio Prisma
// consulta para el filtro automatico de companyId y para fijar la variable de sesion de
// RLS. Poblado exclusivamente por TenantContextGuard (apps/api/src/app/context), a partir
// del JWT ya validado - nunca del body/query del cliente (docs/05-CONVENCIONES-BACKEND.md
// SS7). Vive en persistence-kernel (no en apps/api) porque tenant-scope.extension.ts/
// PrismaUnitOfWork/ReadTransaction, todos en esta misma libreria, lo necesitan - libs/ no
// puede importar apps/ (tooling/eslint/boundaries.mjs).
//
// Implementado sobre nestjs-cls (AsyncLocalStorage) en vez de un provider REQUEST-scoped de
// Nest: el Prisma Client Extension de tenant-scope se construye una unica vez sobre el
// PrismaClient singleton, fuera de cualquier subarbol de DI por-request - un provider
// REQUEST-scoped no es visible ahi. CLS es el mecanismo que sí atraviesa esa frontera.
export interface RequestContextData {
  readonly companyId: string;
  readonly branchId?: string;
  readonly userId: string;
  readonly roles: readonly string[];
}

const REQUEST_CONTEXT_KEY = 'requestContext';

@Injectable()
export class RequestContext {
  constructor(private readonly cls: ClsService) {}

  set(data: RequestContextData): void {
    this.cls.set(REQUEST_CONTEXT_KEY, data);
  }

  get(): RequestContextData {
    const data = this.cls.get<RequestContextData>(REQUEST_CONTEXT_KEY);
    if (!data) {
      // Cualquier repositorio/UnitOfWork que llegue hasta aca sin que TenantContextGuard
      // haya corrido antes es un error de composicion (endpoint protegido mal armado), no
      // un caso de negocio a manejar con gracia.
      throw new Error('RequestContext no inicializado - TenantContextGuard no corrio antes.');
    }
    return data;
  }

  tryGet(): RequestContextData | undefined {
    return this.cls.get<RequestContextData>(REQUEST_CONTEXT_KEY);
  }
}
