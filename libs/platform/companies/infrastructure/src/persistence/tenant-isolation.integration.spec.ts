import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// Test de fuga cross-tenant para Organization (ADR-0004, docs/persistence/06-RLS.md SS7),
// mismo patron que libs/platform/users/infrastructure/.../tenant-isolation.integration.spec.ts
// (Identity & Access). Corre contra Postgres real (Testcontainers). Cubre el caso especial
// de companies (RLS compara su propio id, no company_id, docs/persistence/06-RLS.md SS4.1) y
// el mecanismo de bootstrap nuevo de esta tanda (WITH CHECK implicito via id generado en
// dominio, docs/persistence/10-DECISIONES.md).
describe('Aislamiento de tenant via RLS (organization.*)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let branchA: string;
  let branchB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    branchA = randomUUID();
    branchB = randomUUID();

    await migratorClient.query(
      `INSERT INTO organization.companies (id, legal_name, tax_id, billing_contact_email, status, updated_at, version)
       VALUES ($1, 'Company A', $2, 'a@example.com', 'Active', now(), 1),
              ($3, 'Company B', $4, 'b@example.com', 'Active', now(), 1)`,
      [companyA, `tax-a-${companyA}`, companyB, `tax-b-${companyB}`],
    );

    await migratorClient.query(
      `INSERT INTO organization.branches
         (id, company_id, name, address_line1, address_city, address_country, operating_hours, status, updated_at, version)
       VALUES
         ($1, $2, 'Branch A', 'Calle 1', 'Ciudad A', 'Pais A', '[]'::jsonb, 'Active', now(), 1),
         ($3, $4, 'Branch B', 'Calle 2', 'Ciudad B', 'Pais B', '[]'::jsonb, 'Active', now(), 1)`,
      [branchA, companyA, branchB, companyB],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM organization.branches WHERE id = ANY($1)', [
      [branchA, branchB],
    ]);
    await migratorClient.query('DELETE FROM organization.companies WHERE id = ANY($1)', [
      [companyA, companyB],
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

  it('companies: bajo el contexto de company A, solo ve su propia fila (RLS compara id, no company_id)', async () => {
    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM organization.companies WHERE id = ANY($1)', [
        [companyA, companyB],
      ]),
    );

    const ids = result.rows.map((row: { id: string }) => row.id);
    expect(ids).toEqual([companyA]);
  });

  it('branches: aislamiento estandar por company_id en ambas direcciones', async () => {
    const fromA = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM organization.branches WHERE id = ANY($1)', [
        [branchA, branchB],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([branchA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM organization.branches WHERE id = ANY($1)', [
        [branchA, branchB],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([branchB]);
  });

  it('fail-closed: sin SET LOCAL, ninguna tabla de organization devuelve filas (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const companiesResult = await isolatedClient.query(
        'SELECT id FROM organization.companies WHERE id = ANY($1)',
        [[companyA, companyB]],
      );
      expect(companiesResult.rows).toHaveLength(0);

      const branchesResult = await isolatedClient.query(
        'SELECT id FROM organization.branches WHERE id = ANY($1)',
        [[branchA, branchB]],
      );
      expect(branchesResult.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('bootstrap: un INSERT de company nueva pasa el WITH CHECK implicito fijando app.current_company_id al id que se esta insertando', async () => {
    const newCompanyId = randomUUID();

    await appRuntimeClient.query('BEGIN');
    await appRuntimeClient.query("SELECT set_config('app.current_company_id', $1, true)", [
      newCompanyId,
    ]);
    await appRuntimeClient.query(
      `INSERT INTO organization.companies (id, legal_name, tax_id, billing_contact_email, status, updated_at, version)
       VALUES ($1, 'Bootstrap Co', $2, 'bootstrap@example.com', 'Active', now(), 1)`,
      [newCompanyId, `tax-bootstrap-${newCompanyId}`],
    );
    await appRuntimeClient.query('COMMIT');

    const visibleToItself = await withCompanyContext(newCompanyId, () =>
      appRuntimeClient.query('SELECT id FROM organization.companies WHERE id = $1', [newCompanyId]),
    );
    expect(visibleToItself.rows).toHaveLength(1);

    const invisibleToOther = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM organization.companies WHERE id = $1', [newCompanyId]),
    );
    expect(invisibleToOther.rows).toHaveLength(0);

    await migratorClient.query('DELETE FROM organization.companies WHERE id = $1', [newCompanyId]);
  });
});
