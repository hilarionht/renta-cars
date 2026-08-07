import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { config as loadEnv } from 'dotenv';

import { registerContainer } from '../../../../tooling/testing/testcontainers/container-registry';
import { startPostgresContainer } from '../../../../tooling/testing/testcontainers/postgres';
import { startRedisContainer } from '../../../../tooling/testing/testcontainers/redis';
import { registerApiProcess } from './process-registry';

// docs/engineering/04-TESTING-FOUNDATION.md SS5: apps/api-e2e levanta una instancia real
// de apps/api "en proceso de test" - se interpreta como el binario ya compilado
// (dist/apps/api/main.js, con `api:build` como dependencia del target `test`,
// apps/api-e2e/project.json), nunca importando AppModule directamente: apps/ no tiene
// alias de TypeScript (docs/technical/01-MONOREPO.md SS8 solo lo define para libs/), asi
// que un e2e trata la app como caja negra igual que un cliente HTTP real.
const WORKSPACE_ROOT = join(__dirname, '..', '..', '..', '..');
const API_PORT = 3333;

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // apps/api todavia no acepta conexiones - se reintenta.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`apps/api no respondio en ${url} dentro de ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  loadEnv({ path: join(WORKSPACE_ROOT, '.env') });

  const postgres = await startPostgresContainer();
  registerContainer('api-e2e-postgres', postgres.container);

  const redis = await startRedisContainer();
  registerContainer('api-e2e-redis', redis.container);

  const apiProcess = spawn('node', [join(WORKSPACE_ROOT, 'dist/apps/api/main.js')], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      PORT: String(API_PORT),
      DATABASE_URL: postgres.connectionUri,
      REDIS_URL: redis.connectionUri,
    },
    // stdio heredado: si apps/api falla al arrancar (p.ej. env invalida), el error real
    // aparece en la salida de `nx run api-e2e:test` en vez de perderse en un pipe sin leer.
    stdio: 'inherit',
  });
  registerApiProcess(apiProcess);

  await waitForHealth(`http://localhost:${API_PORT}/health/live`, 30000);

  process.env.API_E2E_BASE_URL = `http://localhost:${API_PORT}`;
}
