// Fase 6/Hardening "load testing multi-tenant" (docs/01-ROADMAP.md SS8,
// docs/persistence/10-DECISIONES.md #107). Siembra N companies reales + un admin cada una +
// M customers taggeados por company, para que tooling/load-testing/scenarios/
// tenant-isolation.js pueda verificar aislamiento de datos bajo concurrencia real.
//
// Mismo patron de insert directo que apps/api-e2e/src/support/seed-identity.ts (rol System +
// usuario + user_roles) - no existe camino via API para el primer usuario de una company
// (POST /users exige JWT ya autenticado, gap aceptado desde Identity & Access). Conecta con
// DATABASE_URL (no APP_DATABASE_URL) - en este entorno "renta" ES el superusuario que cumple
// el rol de "migrator" (comentario de la migracion identity_rls), bypassea RLS por ser
// superusuario, sin necesitar SET LOCAL.
//
// Presupuesto de throttle respetado por diseno (decision del usuario, no reabre #104):
// COMPANIES=6 default, bien por debajo del perfil auth (8/60s) para los logins; COMPANIES x
// CUSTOMERS_PER_COMPANY <= 20 (perfil general) para los creates de customer. Valores baseline,
// no calibrados contra trafico real - mismo criterio que throttle-profiles.ts.

import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { hashSync } from '@node-rs/argon2';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv();

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const COMPANIES = Number(process.env.COMPANIES ?? 6);
const CUSTOMERS_PER_COMPANY = Number(process.env.CUSTOMERS_PER_COMPANY ?? 3);
const OUTPUT_DIR = join(__dirname, '.output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'companies.json');

// Mismos parametros que apps/api/src/config/security.config.ts - si cambian ahi, deben
// cambiar aca tambien (mismo criterio que seed-identity.ts).
const ARGON2_PARAMS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };
const ADMIN_PASSWORD = 'LoadTest!Sup3rSecret';

interface SeededCompany {
  companyIndex: number;
  companyId: string;
  accessToken: string;
}

async function registerCompany(companyIndex: number): Promise<string> {
  const taxId = `loadtest-${companyIndex}-${randomUUID()}`;
  const response = await fetch(`${API_BASE_URL}/api/v1/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      legalName: `LoadTest Company ${companyIndex}`,
      taxId,
      billingContactEmail: `loadtest-${companyIndex}@example.com`,
    }),
  });
  if (!response.ok) {
    throw new Error(`POST /companies fallo para company ${companyIndex}: HTTP ${response.status}`);
  }
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
}

// Insert directo, mismo shape que seed-identity.ts. permissions: [] porque este admin solo
// necesita crear/listar customers (users:create y customers:* no hacen falta - el catalogo
// completo de RBAC lo prueba permissions-enforcement.e2e-spec.ts, no este load test).
async function seedAdmin(
  client: Client,
  companyId: string,
  companyIndex: number,
): Promise<{ email: string }> {
  const systemRoleId = randomUUID();
  const adminUserId = randomUUID();
  const adminEmail = `loadtest-admin-${companyIndex}-${randomUUID()}@example.com`;
  const passwordHash = hashSync(ADMIN_PASSWORD, ARGON2_PARAMS);

  await client.query(
    `INSERT INTO identity.roles (id, company_id, role_name, scope, status, permissions, updated_at, version)
     VALUES ($1, NULL, $2, 'System', 'Active', $3, now(), 1)`,
    [systemRoleId, `LoadTest System Role ${companyIndex}`, ['customers:create']],
  );

  await client.query(
    `INSERT INTO identity.users (id, company_id, email, password_hash, name, status, updated_at, version)
     VALUES ($1, $2, $3, $4, $5, 'Active', now(), 1)`,
    [adminUserId, companyId, adminEmail, passwordHash, `LoadTest Admin ${companyIndex}`],
  );

  await client.query(
    `INSERT INTO identity.user_roles (user_id, role_id, company_id, updated_at)
     VALUES ($1, $2, $3, now())`,
    [adminUserId, systemRoleId, companyId],
  );

  return { email: adminEmail };
}

async function login(companyId: string, email: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, email, password: ADMIN_PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(`POST /auth/login fallo para ${email}: HTTP ${response.status}`);
  }
  const body = (await response.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

async function seedCustomers(
  accessToken: string,
  companyIndex: number,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const response = await fetch(`${API_BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: `LoadTest-${companyIndex}-${i}`,
        taxIdOrDocumentId: `doc-loadtest-${companyIndex}-${i}-${randomUUID()}`,
        contactEmail: `customer-${companyIndex}-${i}@example.com`,
        contactPhone: '+541100000000',
        customerType: 'Individual',
      }),
    });
    if (!response.ok) {
      throw new Error(
        `POST /customers fallo para company ${companyIndex} customer ${i}: HTTP ${response.status}`,
      );
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `Sembrando ${COMPANIES} companies x ${CUSTOMERS_PER_COMPANY} customers contra ${API_BASE_URL}...`,
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const seeded: SeededCompany[] = [];
  try {
    for (let companyIndex = 0; companyIndex < COMPANIES; companyIndex++) {
      const companyId = await registerCompany(companyIndex);
      const { email } = await seedAdmin(client, companyId, companyIndex);
      const accessToken = await login(companyId, email);
      await seedCustomers(accessToken, companyIndex, CUSTOMERS_PER_COMPANY);
      seeded.push({ companyIndex, companyId, accessToken });
      console.log(`  company ${companyIndex}: ${companyId} - ${CUSTOMERS_PER_COMPANY} customers`);
    }
  } finally {
    await client.end();
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(seeded, null, 2));
  console.log(`Setup completo: ${OUTPUT_FILE}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
