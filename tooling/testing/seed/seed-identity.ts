import { randomUUID } from 'node:crypto';

import { hashSync } from '@node-rs/argon2';
import { Client } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { PERMISSION_CATALOG } from '@platform/roles-permissions/domain';

// Sembrado directo en Postgres (rol migrator, exento de RLS) para los e2e de auth. Companies
// ya tiene un camino real via API (POST /api/v1/companies, @Public()) - lo que sigue sin
// existir es un camino via API para el PRIMER usuario de una company (POST /api/v1/users
// exige un JWT ya autenticado), gap aceptado en la tanda de Identity & Access. Mismos
// parametros de argon2id que security.config.ts (apps/api) - si cambian ahi, deben cambiar
// aca tambien.
const ARGON2_PARAMS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export interface SeededAdmin {
  systemRoleId: string;
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
}

export interface SeededCompany extends SeededAdmin {
  companyId: string;
}

// companyId debe pertenecer a una company que ya existe (creada por API o sembrada aparte) -
// esta funcion solo agrega el rol System + el usuario admin para ella.
export async function seedAdminForCompany(companyId: string): Promise<SeededAdmin> {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    // v7 (#140): EntityId.from exige v7; un role System v4 daba 500 al editarlo o desactivarlo.
    const systemRoleId = uuidv7();
    // v7, no v4 - User.id se reconstituye via EntityId.from<'User'>() (PrismaUserRepository.
    // toDomain()), que exige UUID v7 (bug real encontrado por el e2e de recuperacion de
    // contraseña, docs/persistence/10-DECISIONES.md #113 - primer caller de
    // UserRepository.findByCompanyAndEmail()/findById() contra un admin sembrado aca).
    const adminUserId = uuidv7();
    const adminEmail = `admin-${randomUUID()}@example.com`;
    const adminPassword = 'Sup3rSecret!123';
    const passwordHash = hashSync(adminPassword, ARGON2_PARAMS);

    // Admin de bootstrap de test omnisciente (todo el catalogo real, nunca una copia a mano) -
    // no es un actor real cuyos permisos limitados esten bajo prueba (eso lo cubre
    // permissions-enforcement.e2e-spec.ts, con un rol curado creado via la API real).
    await client.query(
      `INSERT INTO identity.roles (id, company_id, role_name, scope, status, permissions, updated_at, version)
       VALUES ($1, NULL, $2, 'System', 'Active', $3, now(), 1)`,
      [systemRoleId, `System Role e2e ${systemRoleId}`, PERMISSION_CATALOG],
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

    return { systemRoleId, adminUserId, adminEmail, adminPassword };
  } finally {
    await client.end();
  }
}

export async function seedCompanyWithAdmin(): Promise<SeededCompany> {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  // v7 (#140): UpdateCompanyDetailsHandler hace EntityId.from(companyId).
  const companyId = uuidv7();
  try {
    await client.query(
      `INSERT INTO organization.companies (id, legal_name, tax_id, billing_contact_email, status, updated_at, version)
       VALUES ($1, $2, $3, 'billing@example.com', 'Active', now(), 1)`,
      [companyId, `Company e2e ${companyId}`, `tax-${companyId}`],
    );
  } finally {
    await client.end();
  }

  const admin = await seedAdminForCompany(companyId);
  return { companyId, ...admin };
}

export interface SeededBranchUser {
  userId: string;
  email: string;
  password: string;
}

// docs/persistence/10-DECISIONES.md #135: usuario con sucursal en el token (users.branch_id),
// con el mismo rol System que el admin. Sirve para verificar que un usuario de sucursal no
// puede pedir datos de otra sucursal via ?branchId=.
export async function seedBranchUserForCompany(
  companyId: string,
  roleId: string,
  branchId: string,
): Promise<SeededBranchUser> {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    const userId = uuidv7();
    const email = `branch-user-${randomUUID()}@example.com`;
    const password = 'Sup3rSecret!123';
    await client.query(
      `INSERT INTO identity.users (id, company_id, branch_id, email, password_hash, name, status, updated_at, version)
       VALUES ($1, $2, $3, $4, $5, 'Branch User E2E', 'Active', now(), 1)`,
      [userId, companyId, branchId, email, hashSync(password, ARGON2_PARAMS)],
    );
    await client.query(
      `INSERT INTO identity.user_roles (user_id, role_id, company_id, updated_at)
       VALUES ($1, $2, $3, now())`,
      [userId, roleId, companyId],
    );
    return { userId, email, password };
  } finally {
    await client.end();
  }
}

// docs/persistence/10-DECISIONES.md #148: usuario del personal sin sucursal, con un rol ya
// existente (p. ej. el System del admin). El e2e de la web crea uno por worker: cada uno tiene su
// propia sesion, asi que una revocacion por refresh reusado nunca cruza entre workers.
export async function seedUserForCompany(
  companyId: string,
  roleId: string,
): Promise<SeededBranchUser> {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    const userId = uuidv7();
    const email = `staff-${randomUUID()}@example.com`;
    const password = 'Sup3rSecret!123';
    await client.query(
      `INSERT INTO identity.users (id, company_id, email, password_hash, name, status, updated_at, version)
       VALUES ($1, $2, $3, $4, 'Staff E2E', 'Active', now(), 1)`,
      [userId, companyId, email, hashSync(password, ARGON2_PARAMS)],
    );
    await client.query(
      `INSERT INTO identity.user_roles (user_id, role_id, company_id, updated_at)
       VALUES ($1, $2, $3, now())`,
      [userId, roleId, companyId],
    );
    return { userId, email, password };
  } finally {
    await client.end();
  }
}
