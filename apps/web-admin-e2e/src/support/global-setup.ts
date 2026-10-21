import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';

import { config as loadEnv } from 'dotenv';

import { startPostgresContainer } from '../../../../tooling/testing/testcontainers/postgres';
import { startRedisContainer } from '../../../../tooling/testing/testcontainers/redis';
import { startRustfsContainer } from '../../../../tooling/testing/testcontainers/rustfs';
import { ensureBucketWithWebCors } from '../../../../tooling/testing/storage/bucket-cors';
import {
  createBranch,
  createCategoryWithRate,
  createCompany,
  loginStaff,
} from '../../../../tooling/testing/seed/api-seed';
import { resetThrottler } from '../../../../tooling/testing/seed/reset-throttler';
import { seedAdminForCompany } from '../../../../tooling/testing/seed/seed-identity';
import { E2E_API_PORT, E2E_STORAGE_ORIGIN, E2E_STORAGE_PORT, E2E_WEB_ORIGIN } from './ports';

// docs/persistence/10-DECISIONES.md #146 y #148: arranque del e2e de la web.
// - CI (por defecto): autocontenido, como apps/api-e2e. Postgres (con migraciones), Redis y
//   RustFS por testcontainers, y el API compilado en E2E_API_PORT. RustFS va en un puerto FIJO:
//   la web (webServer, arranca antes que esto) fija el origen del storage en la CSP al compilar.
// - Local (WEB_E2E_EXTERNAL=1, sin Docker): el API, la base, RustFS nativo y el dev server de la
//   web de desarrollo.
// Siembra solo la base compartida (company, admin, sucursal, categoria); cada spec arma sus
// propios datos con las fixtures (src/support/fixtures.ts). Deja todo en process.env (Playwright
// se lo pasa a los workers) y devuelve su propio teardown.
const WORKSPACE_ROOT = join(__dirname, '..', '..', '..', '..');
const LOCAL_WEB_ORIGIN = 'http://localhost:4200';

type Cleanup = () => Promise<void>;

interface Runtime {
  apiUrl: string;
  redisUrl: string;
  storageOrigin: string;
}

async function assertPortFree(port: number, what: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`El puerto ${port} esta ocupado (${what}).`)));
    server.listen(port, () => server.close(() => resolve()));
  });
}

async function waitForHealth(url: string, child: ChildProcess, timeoutMs: number): Promise<void> {
  let exited = false;
  child.once('exit', () => (exited = true));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error('apps/api termino antes de estar sano (ver su salida arriba).');
    }
    try {
      if ((await fetch(url)).ok) {
        return;
      }
    } catch {
      // Todavia no acepta conexiones.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`apps/api no respondio en ${url} dentro de ${timeoutMs}ms`);
}

async function startSelfContained(cleanups: Cleanup[]): Promise<Runtime> {
  const postgres = await startPostgresContainer();
  cleanups.push(async () => {
    await postgres.container.stop();
  });
  process.env.TEST_DATABASE_URL = postgres.connectionUri;

  const redis = await startRedisContainer();
  cleanups.push(async () => {
    await redis.container.stop();
  });

  await assertPortFree(E2E_STORAGE_PORT, 'storage del e2e');
  const s3 = await startRustfsContainer({ hostPort: E2E_STORAGE_PORT });
  cleanups.push(async () => {
    await s3.container.stop();
  });
  await ensureBucketWithWebCors({
    endpoint: s3.endpoint,
    region: s3.region,
    accessKey: s3.accessKey,
    secretKey: s3.secretKey,
    bucket: s3.bucket,
    origins: [E2E_WEB_ORIGIN],
  });

  await assertPortFree(E2E_API_PORT, 'otro apps/api corriendo');
  const api = spawn('node', [join(WORKSPACE_ROOT, 'dist/apps/api/main.js')], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      PORT: String(E2E_API_PORT),
      LOG_LEVEL: 'warn',
      DATABASE_URL: postgres.connectionUri,
      APP_DATABASE_URL: postgres.appRuntimeConnectionUri,
      PLATFORM_ADMIN_DATABASE_URL: postgres.platformAdminConnectionUri,
      MFA_SECRET_ENCRYPTION_KEY: '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
      REDIS_URL: redis.connectionUri,
      CORS_ORIGINS: E2E_WEB_ORIGIN,
      STORAGE_ENDPOINT: s3.endpoint,
      STORAGE_BUCKET: s3.bucket,
      STORAGE_ACCESS_KEY: s3.accessKey,
      STORAGE_SECRET_KEY: s3.secretKey,
      STORAGE_REGION: s3.region,
    },
    stdio: 'inherit',
  });
  // Espera a que el API termine antes de seguir con el teardown: si no, se detiene Redis
  // mientras el API todavia cierra y llena el log de reconexiones fallidas.
  cleanups.push(async () => {
    if (api.exitCode !== null) {
      return;
    }
    const exited = new Promise<void>((resolve) => api.once('exit', () => resolve()));
    api.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  });

  const apiUrl = `http://localhost:${E2E_API_PORT}`;
  await waitForHealth(`${apiUrl}/health/live`, api, 60_000);
  return { apiUrl, redisUrl: redis.connectionUri, storageOrigin: E2E_STORAGE_ORIGIN };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} en el .env (modo local del e2e de la web).`);
  }
  return value;
}

async function useLocal(): Promise<Runtime> {
  // El seed escribe con el rol dueño (exento de RLS), como los e2e del API en local.
  process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL;
  const endpoint = required('STORAGE_ENDPOINT');
  try {
    if (!(await fetch(`${endpoint}/health`)).ok) {
      throw new Error('health no OK');
    }
  } catch {
    throw new Error(
      `RustFS no responde en ${endpoint}: levantalo (docs/engineering/11-ENTORNO-LOCAL-NATIVO.md §4.1).`,
    );
  }
  await ensureBucketWithWebCors({
    endpoint,
    region: required('STORAGE_REGION'),
    accessKey: required('STORAGE_ACCESS_KEY'),
    secretKey: required('STORAGE_SECRET_KEY'),
    bucket: required('STORAGE_BUCKET'),
    origins: [LOCAL_WEB_ORIGIN],
  });
  return {
    apiUrl: process.env.WEB_E2E_API_URL ?? 'http://localhost:3000',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    storageOrigin: new URL(endpoint).origin,
  };
}

async function seedBase(runtime: Runtime): Promise<void> {
  const companyId = await createCompany(runtime.apiUrl);
  // El primer admin no tiene camino por API: se siembra directo en la base.
  const admin = await seedAdminForCompany(companyId);
  const api = await loginStaff(runtime.apiUrl, {
    companyId,
    email: admin.adminEmail,
    password: admin.adminPassword,
  });
  const branch = await createBranch(api);
  const category = await createCategoryWithRate(api);

  Object.assign(process.env, {
    WEB_E2E_API_URL: runtime.apiUrl,
    WEB_E2E_REDIS_URL: runtime.redisUrl,
    WEB_E2E_STORAGE_ORIGIN: runtime.storageOrigin,
    WEB_E2E_COMPANY_ID: companyId,
    WEB_E2E_SYSTEM_ROLE_ID: admin.systemRoleId,
    WEB_E2E_EMAIL: admin.adminEmail,
    WEB_E2E_PASSWORD: admin.adminPassword,
    WEB_E2E_BRANCH_ID: branch.id,
    WEB_E2E_BRANCH_NAME: branch.name,
    WEB_E2E_CATEGORY_ID: category.id,
    WEB_E2E_CATEGORY_NAME: category.name,
  });
}

export default async function globalSetup(): Promise<Cleanup> {
  loadEnv({ path: join(WORKSPACE_ROOT, '.env'), quiet: true });
  const cleanups: Cleanup[] = [];
  const teardown: Cleanup = async () => {
    for (const cleanup of cleanups.reverse()) {
      await cleanup().catch((error: unknown) => console.error('Teardown del e2e web:', error));
    }
  };

  try {
    const runtime =
      process.env.WEB_E2E_EXTERNAL === '1' ? await useLocal() : await startSelfContained(cleanups);
    await seedBase(runtime);
    // El seed hizo un login: el limite de auth es de 8 por minuto.
    await resetThrottler(runtime.redisUrl);
  } catch (error) {
    await teardown();
    throw error;
  }
  return teardown;
}
