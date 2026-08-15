import { randomUUID } from 'node:crypto';

import { hashSync } from '@node-rs/argon2';
import { Client } from 'pg';

// Sembrado directo en Postgres (rol migrator, exento de RLS) para los e2e de auth - no hay
// ningun camino via API para crear la PRIMERA company/usuario/rol (Companies, Fase 0 items
// 3-4, no existe todavia). Mismos parametros de argon2id que security.config.ts
// (apps/api) - si cambian ahi, deben cambiar aca tambien.
const ARGON2_PARAMS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export interface SeededCompany {
  companyId: string;
  systemRoleId: string;
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
}

export async function seedCompanyWithAdmin(): Promise<SeededCompany> {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    const companyId = randomUUID();
    const systemRoleId = randomUUID();
    const adminUserId = randomUUID();
    const adminEmail = `admin-${randomUUID()}@example.com`;
    const adminPassword = 'Sup3rSecret!123';
    const passwordHash = hashSync(adminPassword, ARGON2_PARAMS);

    await client.query(
      `INSERT INTO identity.roles (id, company_id, role_name, scope, status, permissions, updated_at, version)
       VALUES ($1, NULL, $2, 'System', 'Active', ARRAY['users:create','roles:create'], now(), 1)`,
      [systemRoleId, `System Role e2e ${systemRoleId}`],
    );

    await client.query(
      `INSERT INTO identity.users (id, company_id, email, password_hash, name, status, updated_at, version)
       VALUES ($1, $2, $3, $4, 'Admin E2E', 'Active', now(), 1)`,
      [adminUserId, companyId, adminEmail, passwordHash],
    );

    await client.query(
      `INSERT INTO identity.user_roles (user_id, role_id, company_id, updated_at)
       VALUES ($1, $2, $3, now())`,
      [adminUserId, systemRoleId, companyId],
    );

    return { companyId, systemRoleId, adminUserId, adminEmail, adminPassword };
  } finally {
    await client.end();
  }
}
