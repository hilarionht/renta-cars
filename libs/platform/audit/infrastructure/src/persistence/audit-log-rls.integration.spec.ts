import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS de support.audit_log (INV-024, docs/model/07-INVARIANTS.md SS1/SS6, docs/persistence/
// 06-RLS.md SS4.4) - mismo patron que
// libs/platform/companies/infrastructure/.../tenant-isolation.integration.spec.ts. Corre
// contra Postgres real (Testcontainers). Cubre dos capas de defensa independientes:
// RLS (filtra filas visibles) y GRANT (filtra que operaciones existen del todo para
// app_runtime - sin UPDATE/DELETE, la unica excepcion respecto al resto del modelo).
describe('Aislamiento de tenant + append-only via RLS/GRANT (support.audit_log)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let entryA: string;
  let entryB: string;
  let entryGlobal: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    entryA = randomUUID();
    entryB = randomUUID();
    entryGlobal = randomUUID();

    await migratorClient.query(
      `INSERT INTO support.audit_log (id, company_id, actor_ref, action, subject_type, subject_id, payload, occurred_at)
       VALUES
         ($1, $2, 'user-a', 'BranchOpened.v1', 'Branch', 'branch-a', '{}'::jsonb, now()),
         ($3, $4, 'user-b', 'BranchOpened.v1', 'Branch', 'branch-b', '{}'::jsonb, now()),
         ($5, NULL, 'system', 'PlatformEvent.v1', 'Platform', 'platform', '{}'::jsonb, now())`,
      [entryA, companyA, entryB, companyB, entryGlobal],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM support.audit_log WHERE id = ANY($1)', [
      [entryA, entryB, entryGlobal],
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

  it('aislamiento estandar: bajo el contexto de company A, solo ve su propia fila y la global', async () => {
    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM support.audit_log WHERE id = ANY($1) ORDER BY id', [
        [entryA, entryB, entryGlobal],
      ]),
    );

    const ids = result.rows.map((row: { id: string }) => row.id);
    expect(ids.sort()).toEqual([entryA, entryGlobal].sort());
  });

  it('aislamiento estandar: bajo el contexto de company B, solo ve su propia fila y la global', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM support.audit_log WHERE id = ANY($1) ORDER BY id', [
        [entryA, entryB, entryGlobal],
      ]),
    );

    const ids = result.rows.map((row: { id: string }) => row.id);
    expect(ids.sort()).toEqual([entryB, entryGlobal].sort());
  });

  it('company_id IS NULL: la fila global es visible sin importar el contexto de company', async () => {
    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM support.audit_log WHERE id = $1', [entryGlobal]),
    );

    expect(result.rows).toHaveLength(1);
  });

  it('fail-closed: sin SET LOCAL, las filas con company_id real quedan invisibles (la global no - OR company_id IS NULL no depende de current_setting)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const scopedResult = await isolatedClient.query(
        'SELECT id FROM support.audit_log WHERE id = ANY($1)',
        [[entryA, entryB]],
      );
      expect(scopedResult.rows).toHaveLength(0);

      const globalResult = await isolatedClient.query(
        'SELECT id FROM support.audit_log WHERE id = $1',
        [entryGlobal],
      );
      expect(globalResult.rows).toHaveLength(1);
    } finally {
      await isolatedClient.end();
    }
  });

  it('INV-024: app_runtime no tiene permiso de UPDATE sobre audit_log (GRANT, no RLS)', async () => {
    await expect(
      withCompanyContext(companyA, () =>
        appRuntimeClient.query(
          "UPDATE support.audit_log SET action = 'Tampered.v1' WHERE id = $1",
          [entryA],
        ),
      ),
    ).rejects.toThrow(/permission denied for table audit_log/);
  });

  it('INV-024: app_runtime no tiene permiso de DELETE sobre audit_log (GRANT, no RLS)', async () => {
    await expect(
      withCompanyContext(companyA, () =>
        appRuntimeClient.query('DELETE FROM support.audit_log WHERE id = $1', [entryA]),
      ),
    ).rejects.toThrow(/permission denied for table audit_log/);
  });
});
