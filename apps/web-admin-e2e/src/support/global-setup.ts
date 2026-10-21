import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { join } from 'node:path';

import { config as loadEnv } from 'dotenv';

import { startPostgresContainer } from '../../../../tooling/testing/testcontainers/postgres';
import { startRedisContainer } from '../../../../tooling/testing/testcontainers/redis';
import { resetThrottler } from '../../../../tooling/testing/seed/reset-throttler';
import { seedAdminForCompany } from '../../../../tooling/testing/seed/seed-identity';
import { E2E_API_PORT } from './ports';

// docs/persistence/10-DECISIONES.md #146: arranque del e2e de la web.
// - CI (por defecto): autocontenido, como apps/api-e2e. Postgres (con migraciones) y Redis por
//   testcontainers, y el API compilado en el puerto E2E_API_PORT. La web la levanta el
//   webServer de playwright.config.mts (arranca antes que esto; no necesita el API para arrancar).
// - Local (WEB_E2E_EXTERNAL=1, sin Docker): usa el API y la base de desarrollo, y el dev server
//   de la web en el 4200.
// En los dos casos siembra por API una company con todo lo que necesita una reserva, y deja los
// datos en process.env (Playwright se los pasa a los workers). Devuelve su propio teardown.
const WORKSPACE_ROOT = join(__dirname, '..', '..', '..', '..');
const E2E_WEB_ORIGIN = 'http://localhost:4300';

type Cleanup = () => Promise<void>;

async function assertPortFree(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(new Error(`El puerto ${port} esta ocupado: hay otro apps/api corriendo.`)),
    );
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

async function startSelfContained(
  cleanups: Cleanup[],
): Promise<{ apiUrl: string; redisUrl: string }> {
  const postgres = await startPostgresContainer();
  cleanups.push(async () => {
    await postgres.container.stop();
  });
  process.env.TEST_DATABASE_URL = postgres.connectionUri;

  const redis = await startRedisContainer();
  cleanups.push(async () => {
    await redis.container.stop();
  });

  await assertPortFree(E2E_API_PORT);
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
      // El recorrido no sube archivos: el API no valida el bucket al arrancar.
      STORAGE_ENDPOINT: 'http://localhost:9',
      STORAGE_BUCKET: 'web-e2e',
      STORAGE_ACCESS_KEY: 'web-e2e',
      STORAGE_SECRET_KEY: 'web-e2e-secret',
      STORAGE_REGION: 'us-east-1',
    },
    stdio: 'inherit',
  });
  cleanups.push(() => {
    api.kill();
    return Promise.resolve();
  });

  const apiUrl = `http://localhost:${E2E_API_PORT}`;
  await waitForHealth(`${apiUrl}/health/live`, api, 60_000);
  return { apiUrl, redisUrl: redis.connectionUri };
}

async function call<T>(
  apiUrl: string,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text}`);
  }
  return (text ? (JSON.parse(text) as { data: T }).data : undefined) as T;
}

// Todo lo que necesita una reserva confirmable, por la API real.
async function seed(apiUrl: string): Promise<void> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  // Por la API (como los e2e del API): la company queda con el modulo Rental habilitado. El
  // primer admin no tiene camino por API y se siembra directo en la base.
  const company = await call<{ id: string }>(apiUrl, 'POST', '/companies', {
    legalName: `Empresa E2E web ${suffix}`,
    taxId: `WEB-E2E-${suffix}-${Date.now()}`,
    billingContactEmail: `billing-${suffix.toLowerCase()}@example.com`,
  });
  const admin = { companyId: company.id, ...(await seedAdminForCompany(company.id)) };
  const { accessToken: token } = await call<{ accessToken: string }>(
    apiUrl,
    'POST',
    '/auth/login',
    {
      companyId: admin.companyId,
      email: admin.adminEmail,
      password: admin.adminPassword,
    },
  );
  const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

  const branchName = `Sucursal E2E ${suffix}`;
  const branch = await call<{ id: string }>(
    apiUrl,
    'POST',
    '/branches',
    {
      name: branchName,
      address: { line1: 'Av. Siempre Viva 123', city: 'CDMX', country: 'MX' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '20:00' }],
      timeZone: 'America/Mexico_City',
    },
    token,
  );

  const category = await call<{ id: string }>(
    apiUrl,
    'POST',
    '/vehicle-categories',
    { name: `Economico ${suffix}` },
    token,
  );
  await call(
    apiUrl,
    'POST',
    `/vehicle-categories/${category.id}/rates`,
    {
      amountMinorUnits: 50_000,
      currency: 'MXN',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    },
    token,
  );

  const licensePlate = `E2E-${suffix}`;
  const vehicle = await call<{ id: string }>(
    apiUrl,
    'POST',
    '/vehicles',
    {
      branchId: branch.id,
      vehicleCategoryId: category.id,
      licensePlate,
      vin: `1HGCM82633A${suffix}`,
    },
    token,
  );
  const vehicleDoc = await call<{ id: string }>(
    apiUrl,
    'POST',
    `/vehicles/${vehicle.id}/documents`,
    { documentType: 'PropertyCard', fileId: 'file-web-e2e-vehicle', expiryDate: days(365) },
    token,
  );
  await call(
    apiUrl,
    'POST',
    `/vehicles/${vehicle.id}/documents/${vehicleDoc.id}/verify`,
    undefined,
    token,
  );
  await call(apiUrl, 'POST', `/vehicles/${vehicle.id}/enable`, undefined, token);

  const customerName = `Cliente E2E ${suffix}`;
  const customer = await call<{ id: string }>(
    apiUrl,
    'POST',
    '/customers',
    {
      name: customerName,
      taxIdOrDocumentId: `E2E-${suffix}`,
      contactEmail: `cliente-${suffix.toLowerCase()}@example.com`,
      contactPhone: `+5255${String(Date.now()).slice(-8)}`,
      customerType: 'Individual',
    },
    token,
  );
  const customerDoc = await call<{ id: string }>(
    apiUrl,
    'POST',
    `/customers/${customer.id}/identity-documents`,
    { documentType: 'NationalId', fileId: 'file-web-e2e-identity', expiryDate: days(365) },
    token,
  );
  await call(
    apiUrl,
    'POST',
    `/customers/${customer.id}/identity-documents/${customerDoc.id}/verify`,
    undefined,
    token,
  );

  process.env.WEB_E2E_COMPANY_ID = admin.companyId;
  process.env.WEB_E2E_EMAIL = admin.adminEmail;
  process.env.WEB_E2E_PASSWORD = admin.adminPassword;
  process.env.WEB_E2E_BRANCH_NAME = branchName;
  process.env.WEB_E2E_CUSTOMER_NAME = customerName;
  process.env.WEB_E2E_LICENSE_PLATE = licensePlate;
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
    let apiUrl: string;
    let redisUrl: string;
    if (process.env.WEB_E2E_EXTERNAL === '1') {
      apiUrl = process.env.WEB_E2E_API_URL ?? 'http://localhost:3000';
      redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
      // El seed escribe con el rol dueño (exento de RLS), como los e2e del API en local.
      process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL;
    } else {
      ({ apiUrl, redisUrl } = await startSelfContained(cleanups));
    }
    await seed(apiUrl);
    // El seed hizo un login: el limite de auth es de 8 por minuto.
    await resetThrottler(redisUrl);
  } catch (error) {
    await teardown();
    throw error;
  }
  return teardown;
}
