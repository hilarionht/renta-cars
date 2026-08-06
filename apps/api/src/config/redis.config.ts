import { registerAs } from '@nestjs/config';

// Namespace "redis" - consumido por redisProvider (apps/api/src/app/redis).
export default registerAs('redis', () => ({
  url: process.env.REDIS_URL,
}));
