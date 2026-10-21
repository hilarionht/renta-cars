import { Redis } from 'ioredis';

// Borra solo las claves del rate limiter (@nest-lab/throttler-storage-redis:
// `{<key>:<throttler>}:hits` / `:blocked`), nunca las de BullMQ (`bull:*`) ni la cache. Lo usan
// los e2e que le pegan muchas veces al mismo apps/api desde la misma IP (docs/persistence/
// 10-DECISIONES.md #126 y #146). El rate limiting real del producto no cambia.
const THROTTLER_KEY_PATTERNS = ['{*}:hits', '{*}:blocked'];

export async function resetThrottler(redisUrl: string): Promise<void> {
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
}
