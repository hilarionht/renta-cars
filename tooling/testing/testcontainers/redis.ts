import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

// Misma version mayor que docker-compose.yml (paso 5) y produccion -
// docs/engineering/04-TESTING-FOUNDATION.md SS2, docs/engineering/06-DOCKER.md SS6.
const REDIS_IMAGE = 'redis:7-alpine';

export interface RedisTestContainer {
  container: StartedRedisContainer;
  connectionUri: string;
}

export async function startRedisContainer(): Promise<RedisTestContainer> {
  const container = await new RedisContainer(REDIS_IMAGE).start();
  // Mismo problema que tooling/testing/testcontainers/postgres.ts: "localhost" resuelve de
  // forma ambigua (IPv6 primero) contra el puerto publicado por Docker Desktop/Windows -
  // ioredis, con `enableOfflineQueue: false` (apps/api/src/app/redis/redis.provider.ts),
  // falla rapido en vez de reintentar con la otra familia de direcciones. "127.0.0.1"
  // explicito evita la ambiguedad.
  const connectionUri = container.getConnectionUrl().replace('localhost', '127.0.0.1');
  return { container, connectionUri };
}

export async function stopRedisContainer(instance: RedisTestContainer): Promise<void> {
  await instance.container.stop();
}
