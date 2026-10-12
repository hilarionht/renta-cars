import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// Test de fuga cross-tenant (ADR-0004, docs/persistence/06-RLS.md §7) - el mas importante de
// esta tanda segun docs/09-SEGURIDAD.md §5 ("el activo critico numero uno"). Corre contra
// Postgres real (Testcontainers, ver tooling/testing/testcontainers), no logica en memoria:
// conecta como `migrator` (TEST_DATABASE_URL, dueño de las tablas, exento de RLS) para
// sembrar datos de dos companies distintas, y como `app_runtime` (TEST_APP_DATABASE_URL,
// sujeto a FORCE ROW LEVEL SECURITY) para leer - exactamente los mismos dos roles que usa
// apps/api en runtime (docs/persistence/10-DECISIONES.md #10).
describe('Aislamiento de tenant via RLS (identity.*)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let userA: string;
  let userB: string;
  let systemRoleId: string;
  let customRoleCompanyB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    userA = randomUUID();
    userB = randomUUID();
    systemRoleId = randomUUID();
    customRoleCompanyB = randomUUID();

    await migratorClient.query(
      `INSERT INTO identity.users (id, company_id, email, password_hash, name, status, updated_at, version)
       VALUES ($1, $2, 'a@example.com', 'hash', 'User A', 'Active', now(), 1),
              ($3, $4, 'b@example.com', 'hash', 'User B', 'Active', now(), 1)`,
      [userA, companyA, userB, companyB],
    );

    await migratorClient.query(
      `INSERT INTO identity.roles (id, company_id, role_name, scope, status, permissions, updated_at, version)
       VALUES ($1, NULL, 'System Role (tenant-isolation spec)', 'System', 'Active', ARRAY['users:create'], now(), 1),
              ($2, $3, 'Custom Role B (tenant-isolation spec)', 'Custom', 'Active', ARRAY['users:create'], now(), 1)`,
      [systemRoleId, customRoleCompanyB, companyB],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM identity.users WHERE id = ANY($1)', [[userA, userB]]);
    await migratorClient.query('DELETE FROM identity.roles WHERE id = ANY($1)', [
      [systemRoleId, customRoleCompanyB],
    ]);
    await migratorClient.end();
    await appRuntimeClient.end();
  });

  async function withCompanyContext<T>(companyId: string, work: () => Promise<T>): Promise<T> {
    await appRuntimeClient.query('BEGIN');
    try {
      await appRuntimeClient.query("SELECT set_config('app.current_company_id', $1, true)", [
        companyId,
      ]);
      return await work();
    } finally {
      await appRuntimeClient.query('COMMIT');
    }
  }

  it('con app.current_company_id = company A, solo ve usuarios de company A (cero filas de company B)', async () => {
    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id, company_id FROM identity.users WHERE id = ANY($1)', [
        [userA, userB],
      ]),
    );

    const ids = result.rows.map((row: { id: string }) => row.id);
    expect(ids).toContain(userA);
    expect(ids).not.toContain(userB);
  });

  it('con app.current_company_id = company B, solo ve usuarios de company B (cero filas de company A)', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id, company_id FROM identity.users WHERE id = ANY($1)', [
        [userA, userB],
      ]),
    );

    const ids = result.rows.map((row: { id: string }) => row.id);
    expect(ids).toContain(userB);
    expect(ids).not.toContain(userA);
  });

  it('fail-closed: sin SET LOCAL app.current_company_id, una query devuelve cero filas (no un error)', async () => {
    // Sesion nueva del pool, sin BEGIN/set_config previo en esta transaccion - simula el
    // caso que docs/persistence/06-RLS.md §1.4 exige: current_setting(...) vacio -> NULLIF
    // -> NULL -> company_id = NULL nunca es true -> cero filas, nunca una excepcion.
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const result = await isolatedClient.query(
        'SELECT id FROM identity.users WHERE id = ANY($1)',
        [[userA, userB]],
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('un Role System (company_id NULL) es visible desde cualquier tenant; un Role Custom de otra company no', async () => {
    const resultFromCompanyA = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id, company_id FROM identity.roles WHERE id = ANY($1)', [
        [systemRoleId, customRoleCompanyB],
      ]),
    );

    const idsFromA = resultFromCompanyA.rows.map((row: { id: string }) => row.id);
    expect(idsFromA).toContain(systemRoleId);
    expect(idsFromA).not.toContain(customRoleCompanyB);

    const resultFromCompanyB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id, company_id FROM identity.roles WHERE id = ANY($1)', [
        [systemRoleId, customRoleCompanyB],
      ]),
    );

    const idsFromB = resultFromCompanyB.rows.map((row: { id: string }) => row.id);
    expect(idsFromB).toContain(systemRoleId);
    expect(idsFromB).toContain(customRoleCompanyB);
  });
});
