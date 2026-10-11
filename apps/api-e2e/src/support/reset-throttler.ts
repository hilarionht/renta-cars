import { Redis } from 'ioredis';

// setupFilesAfterEnv: corre antes de cada archivo de specs. Todos los specs le pegan al MISMO
// apps/api (global-setup.ts) desde la misma IP, asi que los contadores del rate limiter se
// acumulan entre archivos y terminaban en 429 (docs/persistence/10-DECISIONES.md #126).
// Se borran solo las claves del throttler (@nest-lab/throttler-storage-redis:
// `{<key>:<throttler>}:hits` / `:blocked`), nunca las de BullMQ (`bull:*`) ni la cache.
// El rate limiting real del producto no cambia: cada spec sigue sujeto a los limites
// productivos dentro de su propio archivo.
const THROTTLER_KEY_PATTERNS = ['{*}:hits', '{*}:blocked'];

beforeAll(async () => {
  const redisUrl = process.env.API_E2E_REDIS_URL;
  if (!redisUrl) {
    throw new Error('API_E2E_REDIS_URL no esta definida (la define global-setup.ts).');
  }

  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    for (const pattern of THROTTLER_KEY_PATTERNS) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
        cursor = next;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    }
  } finally {
    redis.disconnect();
  }
});
