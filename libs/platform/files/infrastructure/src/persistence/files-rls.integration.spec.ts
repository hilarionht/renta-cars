import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar de support.files (docs/persistence/06-RLS.md) - a diferencia de
// support.audit_log (append-only, grant restringido), files tiene el GRANT completo
// (SELECT/INSERT/UPDATE/DELETE), mismo patron que
// libs/platform/companies/infrastructure/.../tenant-isolation.integration.spec.ts. Corre
// contra Postgres real (Testcontainers).
describe('Aislamiento de tenant via RLS (support.files)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let fileA: string;
  let fileB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    fileA = randomUUID();
    fileB = randomUUID();

    await migratorClient.query(
      `INSERT INTO support.files (id, company_id, storage_ref, content_type, upload_status, uploaded_by, updated_at, version)
       VALUES
         ($1, $2, $3, 'application/pdf', 'Uploaded', 'user-a', now(), 1),
         ($4, $5, $6, 'application/pdf', 'Uploaded', 'user-b', now(), 1)`,
      [fileA, companyA, `${companyA}/obj-a`, fileB, companyB, `${companyB}/obj-b`],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM support.files WHERE id = ANY($1)', [[fileA, fileB]]);
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

  it('aislamiento estandar por company_id en ambas direcciones', async () => {
    const fromA = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM support.files WHERE id = ANY($1)', [[fileA, fileB]]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([fileA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM support.files WHERE id = ANY($1)', [[fileA, fileB]]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([fileB]);
  });

  it('fail-closed: sin SET LOCAL, ninguna fila es visible (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const result = await isolatedClient.query('SELECT id FROM support.files WHERE id = ANY($1)', [
        [fileA, fileB],
      ]);
      expect(result.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('a diferencia de audit_log (append-only), app_runtime SI puede UPDATE una fila bajo su propio contexto de tenant (delete logico real)', async () => {
    await withCompanyContext(companyA, () =>
      appRuntimeClient.query("UPDATE support.files SET upload_status = 'Deleted' WHERE id = $1", [
        fileA,
      ]),
    );

    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT upload_status FROM support.files WHERE id = $1', [fileA]),
    );
    expect(result.rows[0].upload_status).toBe('Deleted');

    // Revertido para no afectar otros tests de este archivo.
    await withCompanyContext(companyA, () =>
      appRuntimeClient.query("UPDATE support.files SET upload_status = 'Uploaded' WHERE id = $1", [
        fileA,
      ]),
    );
  });

  it('UPDATE bajo el contexto de OTRA company no afecta la fila (invisible, no un error)', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query("UPDATE support.files SET upload_status = 'Deleted' WHERE id = $1", [
        fileA,
      ]),
    );
    expect(result.rowCount).toBe(0);
  });
});
