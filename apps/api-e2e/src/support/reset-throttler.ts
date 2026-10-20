import { resetThrottler } from '../../../../tooling/testing/seed/reset-throttler';

// setupFilesAfterEnv: corre antes de cada archivo de specs. Todos los specs le pegan al MISMO
// apps/api (global-setup.ts) desde la misma IP, asi que los contadores del rate limiter se
// acumulan entre archivos y terminaban en 429 (docs/persistence/10-DECISIONES.md #126).
// Cada spec sigue sujeto a los limites productivos dentro de su propio archivo.
beforeAll(async () => {
  const redisUrl = process.env.API_E2E_REDIS_URL;
  if (!redisUrl) {
    throw new Error('API_E2E_REDIS_URL no esta definida (la define global-setup.ts).');
  }
  await resetThrottler(redisUrl);
});
