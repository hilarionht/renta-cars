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
  return { container, connectionUri: container.getConnectionUrl() };
}

export async function stopRedisContainer(instance: RedisTestContainer): Promise<void> {
  await instance.container.stop();
}
