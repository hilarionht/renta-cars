// Superficie publica de "platform-persistence-kernel" - infraestructura generica de Prisma
// compartida por apps/api y por infrastructure/ de cualquier modulo de negocio.
export { PrismaService } from './prisma.service';
export { RequestContext, type RequestContextData } from './request-context';
export { TENANT_SCOPED_PRISMA } from './tenant-scoped-prisma.token';
export { tenantScopeExtension } from './tenant-scope.extension';
export { PrismaUnitOfWork, asPrismaTransaction } from './prisma-unit-of-work';
export { ReadTransaction } from './read-transaction';
export { OutboxWriter } from './outbox-writer';
export { IS_PUBLIC_KEY, Public } from './public.decorator';
