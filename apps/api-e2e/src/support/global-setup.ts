import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { config as loadEnv } from 'dotenv';

import { registerContainer } from '../../../../tooling/testing/testcontainers/container-registry';
import { startRustfsContainer } from '../../../../tooling/testing/testcontainers/rustfs';
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
  // Expuestas para que los .e2e-spec.ts puedan sembrar datos directo en Postgres (p. ej. el
  // primer usuario/rol de una company, que hoy no tiene ningun camino via API - Companies,
  // Fase 0 items 3-4, no existe todavia) sin pasar por apps/api.
  process.env.TEST_DATABASE_URL = postgres.connectionUri;
  process.env.TEST_APP_DATABASE_URL = postgres.appRuntimeConnectionUri;

  const redis = await startRedisContainer();
  registerContainer('api-e2e-redis', redis.container);

  // Almacenamiento S3 real (RustFS, #143; no el de docker-compose local) - antes de esto,
  // STORAGE_* se heredaba tal cual de .env, dependiendo silenciosamente de que `docker compose
  // up` ya estuviera corriendo en la maquina; con Testcontainers el e2e queda autocontenido,
  // mismo criterio que Postgres/Redis.
  const s3 = await startRustfsContainer();
  registerContainer('api-e2e-s3', s3.container);

  const apiProcess = spawn('node', [join(WORKSPACE_ROOT, 'dist/apps/api/main.js')], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      PORT: String(API_PORT),
      // warn, no info: con stdio heredado, el log por request de pino tapaba el resumen de
      // Jest en CI (la salida se cortaba en medio de un log). Los errores de arranque siguen
      // apareciendo (#125).
      LOG_LEVEL: 'warn',
      DATABASE_URL: postgres.connectionUri,
      APP_DATABASE_URL: postgres.appRuntimeConnectionUri,
      // Sin esto se heredaba de .env (localhost:5432), ajeno al contenedor efimero (#125).
      PLATFORM_ADMIN_DATABASE_URL: postgres.platformAdminConnectionUri,
      // Clave fija solo de test: apps/api no arranca sin ella (Aes256GcmMfaSecretCipher, #111),
      // y en CI .env sale de .env.example, donde esta vacia a proposito. Mismo criterio de
      // e2e autocontenido que STORAGE_* abajo (#125).
      MFA_SECRET_ENCRYPTION_KEY: '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
      REDIS_URL: redis.connectionUri,
      STORAGE_ENDPOINT: s3.endpoint,
      STORAGE_BUCKET: s3.bucket,
      STORAGE_ACCESS_KEY: s3.accessKey,
      STORAGE_SECRET_KEY: s3.secretKey,
      STORAGE_REGION: s3.region,
    },
    // stdio heredado: si apps/api falla al arrancar (p.ej. env invalida), el error real
    // aparece en la salida de `nx run api-e2e:test` en vez de perderse en un pipe sin leer.
    stdio: 'inherit',
  });
  registerApiProcess(apiProcess);

  // 45s en vez de 30s: bajo carga de la maquina (build+containers+arranque compitiendo por
  // CPU/IO en paralelo con otros jobs) el health-check ocasionalmente supera 30s aunque
  // apps/api arranca correctamente - Nx marco esta tarea como flaky con el umbral anterior.
  await waitForHealth(`http://localhost:${API_PORT}/health/live`, 45000);

  process.env.API_E2E_BASE_URL = `http://localhost:${API_PORT}`;
  // reset-throttler.ts borra los contadores del rate limiter entre archivos de specs (#126).
  process.env.API_E2E_REDIS_URL = redis.connectionUri;
}
