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
export {
  REQUIRES_PRODUCT_MODULE_KEY,
  RequiresProductModule,
} from './requires-product-module.decorator';
export { REQUIRE_PERMISSION_KEY, RequirePermission } from './require-permission.decorator';
export {
  REQUIRE_CUSTOMER_ACTOR_KEY,
  RequireCustomerActor,
} from './require-customer-actor.decorator';
export { REQUIRE_STAFF_ACTOR_KEY, RequireStaffActor } from './require-staff-actor.decorator';
export {
  AUTH_THROTTLE_PROFILE,
  WRITE_HEAVY_THROTTLE_PROFILE,
  GENERAL_THROTTLE_PROFILE,
} from './throttle-profiles';
export { CACHE_REDIS_CLIENT, redisClientProvider } from './redis-client.provider';
export { RedisCacheModule } from './redis-cache.module';
