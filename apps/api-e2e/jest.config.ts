// docs/engineering/04-TESTING-FOUNDATION.md SS5: Jest + Supertest contra una instancia
// real de apps/api levantada en proceso de test, con Testcontainers como backing de
// Postgres/Redis (globalSetup/globalTeardown, mismo mecanismo que `infrastructure`, SS1).
export default {
  displayName: 'api-e2e',
  preset: '../../tooling/jest/base.config.ts',
  testEnvironment: 'node',
  testMatch: ['**/*.e2e-spec.ts'],
  globalSetup: './src/support/global-setup.ts',
  globalTeardown: './src/support/global-teardown.ts',
  // Un archivo de specs a la vez (equivale a --runInBand) + contadores del rate limiter
  // reseteados antes de cada archivo: todos comparten un unico apps/api y una misma IP, y
  // en paralelo/acumulado terminaban en 429 (docs/persistence/10-DECISIONES.md #126).
  maxWorkers: 1,
  setupFilesAfterEnv: ['./src/support/reset-throttler.ts'],
  testTimeout: 60000,
};
