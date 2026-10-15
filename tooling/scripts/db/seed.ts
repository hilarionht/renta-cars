// Seed de DESARROLLO local (docs/persistence/10-DECISIONES.md #131,
// docs/engineering/11-ENTORNO-LOCAL-NATIVO.md §5). Deja una company demo lista para usar la
// app a mano y para el smoke test del Reminder (tooling/scripts/smoke/reminder.ts).
//
// Requiere apps/api corriendo (API_BASE_URL, default http://localhost:3000): todo lo que tiene
// camino real se crea via la API, igual que reservation-invoice-notifications.e2e-spec.ts.
// La unica excepcion es el PRIMER admin de la company - no existe camino via API (POST /users
// exige un JWT ya autenticado, gap aceptado desde Identity & Access) - insertado directo en
// Postgres con el mismo shape que apps/api-e2e/src/support/seed-identity.ts, conectando con
// DATABASE_URL (rol dueño de las tablas, exento de RLS), mismo criterio que
// tooling/load-testing/setup.ts.
//
// Idempotente por TAX_ID: si la company demo ya existe no crea nada y vuelve a imprimir las
// credenciales. Credenciales FIJAS y solo de desarrollo - nunca usar fuera de una maquina local.
//
// Nunca corre en CI ni en tests.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { hashSync } from '@node-rs/argon2';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import { v7 as uuidv7 } from 'uuid';

// Ruta relativa, no el alias @platform/... - estos scripts corren con ts-node sin resolucion
// de paths. El archivo no tiene imports propios.
import { PERMISSION_CATALOG } from '../../../libs/platform/roles-permissions/domain/src/value-objects/permission-catalog';

loadEnv();

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;

const TAX_ID = 'DEMO-RENTA-001';
const ADMIN_EMAIL = 'admin@demo.renta.local';
const ADMIN_PASSWORD = 'Demo!Renta2026';
// Mismos parametros que apps/api/src/config/security.config.ts (mismo criterio que
// seed-identity.ts y load-testing/setup.ts).
const ARGON2_PARAMS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

const OUTPUT_DIR = join(__dirname, '.output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'dev-seed.json');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface SeedOutput {
  apiBaseUrl: string;
  companyId: string;
  admin: { email: string; password: string; userId: string };
  branchId: string;
  vehicles: { id: string; licensePlate: string }[];
  customers: { id: string; name: string; phone: string; email: string }[];
  reservations: { id: string; label: string; startDate: string; endDate: string }[];
}

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text}`);
  }
  return (text ? (JSON.parse(text) as { data: T }).data : undefined) as T;
}

async function seedAdmin(client: Client, companyId: string): Promise<string> {
  // v7 (#140): EntityId.from exige v7; un role System v4 daba 500 al editarlo o desactivarlo.
  const systemRoleId = uuidv7();
  // v7, no v4: User.id se reconstituye via EntityId.from<'User'>(), que exige UUID v7 (#113).
  const adminUserId = uuidv7();
  await client.query(
    `INSERT INTO identity.roles (id, company_id, role_name, scope, status, permissions, updated_at, version)
     VALUES ($1, NULL, $2, 'System', 'Active', $3, now(), 1)`,
    [systemRoleId, `System Role demo ${companyId}`, [...PERMISSION_CATALOG]],
  );
  await client.query(
    `INSERT INTO identity.users (id, company_id, email, password_hash, name, status, updated_at, version)
     VALUES ($1, $2, $3, $4, 'Admin Demo', 'Active', now(), 1)`,
    [adminUserId, companyId, ADMIN_EMAIL, hashSync(ADMIN_PASSWORD, ARGON2_PARAMS)],
  );
  await client.query(
    `INSERT INTO identity.user_roles (user_id, role_id, company_id, updated_at)
     VALUES ($1, $2, $3, now())`,
    [adminUserId, systemRoleId, companyId],
  );
  return adminUserId;
}

async function createVehicle(
  token: string,
  branchId: string,
  categoryId: string,
  licensePlate: string,
  vin: string,
): Promise<string> {
  const { id } = await api<{ id: string }>(
    'POST',
    '/vehicles',
    { branchId, vehicleCategoryId: categoryId, licensePlate, vin },
    token,
  );
  const doc = await api<{ id: string }>(
    'POST',
    `/vehicles/${id}/documents`,
    {
      documentType: 'PropertyCard',
      fileId: `file-demo-${licensePlate}`,
      expiryDate: new Date(Date.now() + 5 * 365 * DAY_MS).toISOString(),
    },
    token,
  );
  await api('POST', `/vehicles/${id}/documents/${doc.id}/verify`, undefined, token);
  await api('POST', `/vehicles/${id}/enable`, undefined, token);
  return id;
}

async function createCustomer(
  token: string,
  name: string,
  phone: string,
  email: string,
  documentId: string,
): Promise<string> {
  const { id } = await api<{ id: string }>(
    'POST',
    '/customers',
    {
      name,
      taxIdOrDocumentId: documentId,
      contactEmail: email,
      contactPhone: phone,
      customerType: 'Individual',
    },
    token,
  );
  const doc = await api<{ id: string }>(
    'POST',
    `/customers/${id}/identity-documents`,
    {
      documentType: 'NationalId',
      fileId: `file-demo-${documentId}`,
      expiryDate: new Date(Date.now() + 5 * 365 * DAY_MS).toISOString(),
    },
    token,
  );
  await api('POST', `/customers/${id}/identity-documents/${doc.id}/verify`, undefined, token);
  return id;
}

async function createConfirmedReservation(
  token: string,
  customerId: string,
  vehicleId: string,
  start: Date,
  durationDays: number,
): Promise<{ id: string; startDate: string; endDate: string }> {
  const startDate = start.toISOString();
  const endDate = new Date(start.getTime() + durationDays * DAY_MS).toISOString();
  const { id } = await api<{ id: string }>(
    'POST',
    '/reservations',
    { customerId, vehicleId, startDate, endDate },
    token,
  );
  await api('POST', `/reservations/${id}/confirm`, undefined, token);
  return { id, startDate, endDate };
}

function print(output: SeedOutput, created: boolean): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(
    created ? 'Seed de desarrollo creado.' : 'La company demo ya existia: no se creo nada.',
  );
  console.log(`  companyId : ${output.companyId}`);
  console.log(`  admin     : ${output.admin.email} / ${output.admin.password}`);
  for (const customer of output.customers) {
    console.log(`  cliente   : ${customer.name} (${customer.phone})`);
  }
  for (const reservation of output.reservations) {
    console.log(`  reserva   : ${reservation.label} ${reservation.id} (${reservation.startDate})`);
  }
  console.log(`  detalle   : ${OUTPUT_FILE}`);
}

async function seed(): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL no esta definida (.env).');
  }
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM organization.companies WHERE tax_id = $1',
      [TAX_ID],
    );
    if (existing.rows[0]) {
      if (existsSync(OUTPUT_FILE)) {
        print(JSON.parse(readFileSync(OUTPUT_FILE, 'utf8')) as SeedOutput, false);
      } else {
        console.log(`La company demo ya existe (companyId ${existing.rows[0].id}).`);
        console.log(`  admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
      }
      return;
    }

    const company = await api<{ id: string }>('POST', '/companies', {
      legalName: 'Renta Demo SA',
      taxId: TAX_ID,
      billingContactEmail: 'billing@demo.renta.local',
    });
    const adminUserId = await seedAdmin(client, company.id);

    const login = await api<{ accessToken: string }>('POST', '/auth/login', {
      companyId: company.id,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    const token = login.accessToken;

    const branch = await api<{ id: string }>(
      'POST',
      '/branches',
      {
        name: 'Sucursal Centro',
        address: { line1: 'Av. Reforma 100', city: 'CDMX', country: 'MX' },
        operatingHours: [{ day: 'monday', open: '08:00', close: '20:00' }],
      },
      token,
    );

    const category = await api<{ id: string }>(
      'POST',
      '/vehicle-categories',
      { name: 'Economico' },
      token,
    );
    await api(
      'POST',
      `/vehicle-categories/${category.id}/rates`,
      {
        amountMinorUnits: 50000,
        currency: 'USD',
        unit: 'Day',
        validFrom: new Date(Date.now() - DAY_MS).toISOString(),
      },
      token,
    );

    const vehicles = [
      { licensePlate: 'DEMO-001', vin: '1HGCM82633A100001' },
      { licensePlate: 'DEMO-002', vin: '1HGCM82633A100002' },
    ];
    const vehicleIds: string[] = [];
    for (const vehicle of vehicles) {
      vehicleIds.push(
        await createVehicle(token, branch.id, category.id, vehicle.licensePlate, vehicle.vin),
      );
    }

    const customers = [
      {
        name: 'Ana Demo',
        phone: '+525500009001',
        email: 'ana@demo.renta.local',
        doc: 'DEMO-DOC-1',
      },
      {
        name: 'Luis Demo',
        phone: '+525500009002',
        email: 'luis@demo.renta.local',
        doc: 'DEMO-DOC-2',
      },
    ];
    const customerIds: string[] = [];
    for (const customer of customers) {
      customerIds.push(
        await createCustomer(token, customer.name, customer.phone, customer.email, customer.doc),
      );
    }

    // R1: dentro de la ventana del Reminder (default 24h, ReminderLeadTime.default()) - la que
    // valida tooling/scripts/smoke/reminder.ts. R2: fuera de la ventana, para check-out/check-in
    // desde la app del operador. MinimumBookingLeadTime.default() es 0, asi que +2h es valido.
    const r1 = await createConfirmedReservation(
      token,
      customerIds[0],
      vehicleIds[0],
      new Date(Date.now() + 2 * HOUR_MS),
      2,
    );
    const r2 = await createConfirmedReservation(
      token,
      customerIds[1],
      vehicleIds[1],
      new Date(Date.now() + 3 * DAY_MS),
      3,
    );

    print(
      {
        apiBaseUrl: API_BASE_URL,
        companyId: company.id,
        admin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, userId: adminUserId },
        branchId: branch.id,
        vehicles: vehicleIds.map((id, i) => ({ id, licensePlate: vehicles[i].licensePlate })),
        customers: customerIds.map((id, i) => ({
          id,
          name: customers[i].name,
          phone: customers[i].phone,
          email: customers[i].email,
        })),
        reservations: [
          { label: 'R1 (en ventana de Reminder)', ...r1 },
          { label: 'R2 (para check-out/check-in)', ...r2 },
        ],
      },
      true,
    );
  } finally {
    await client.end();
  }
}

seed().catch((error: unknown) => {
  console.error('Seed fallo:', error);
  process.exitCode = 1;
});
