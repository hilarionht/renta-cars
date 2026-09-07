import { Module } from '@nestjs/common';

import { CACHE_REDIS_CLIENT, redisClientProvider } from './redis-client.provider';

// Modulo estatico simple (no forRoot()/@Global()) - Nest lo instancia una sola vez aunque
// lo importen tanto AppModule (storage de ThrottlerGuard) como RolesPermissionsModule
// (cache de permisos): un mismo nodo en el grafo de modulos, un unico CACHE_REDIS_CLIENT/
// conexion ioredis compartida entre ambos consumidores.
@Module({
  providers: [redisClientProvider],
  exports: [CACHE_REDIS_CLIENT],
})
export class RedisCacheModule {}
