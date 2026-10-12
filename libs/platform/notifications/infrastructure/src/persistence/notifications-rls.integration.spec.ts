import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar de support.notifications (docs/persistence/06-RLS.md) - mismo patron que
// support.files (GRANT completo, no append-only). Corre contra Postgres real
// (Testcontainers).
describe('Aislamiento de tenant via RLS (support.notifications)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let notificationA: string;
  let notificationB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    notificationA = randomUUID();
    notificationB = randomUUID();

    await migratorClient.query(
      `INSERT INTO support.notifications (id, company_id, kind, status, recipient_email, template_id, updated_at, version)
       VALUES
         ($1, $2, 'Alert', 'Pending', 'user-a@example.com', 'user-welcome', now(), 1),
         ($3, $4, 'Alert', 'Pending', 'user-b@example.com', 'user-welcome', now(), 1)`,
      [notificationA, companyA, notificationB, companyB],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM support.notifications WHERE id = ANY($1)', [
      [notificationA, notificationB],
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

  it('aislamiento estandar por company_id en ambas direcciones', async () => {
    const fromA = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM support.notifications WHERE id = ANY($1)', [
        [notificationA, notificationB],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([notificationA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM support.notifications WHERE id = ANY($1)', [
        [notificationA, notificationB],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([notificationB]);
  });

  it('fail-closed: sin SET LOCAL, ninguna fila es visible (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const result = await isolatedClient.query(
        'SELECT id FROM support.notifications WHERE id = ANY($1)',
        [[notificationA, notificationB]],
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('app_runtime puede UPDATE una fila bajo su propio contexto de tenant (transiciones de estado)', async () => {
    await withCompanyContext(companyA, () =>
      appRuntimeClient.query(
        "UPDATE support.notifications SET status = 'Sent', channel = 'Email', provider_reference = 'ref-a', version = 2 WHERE id = $1",
        [notificationA],
      ),
    );

    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT status, channel FROM support.notifications WHERE id = $1', [
        notificationA,
      ]),
    );
    expect(result.rows[0].status).toBe('Sent');
    expect(result.rows[0].channel).toBe('Email');
  });

  it('UPDATE bajo el contexto de OTRA company no afecta la fila (invisible, no un error)', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query("UPDATE support.notifications SET status = 'Failed' WHERE id = $1", [
        notificationA,
      ]),
    );
    expect(result.rowCount).toBe(0);
  });
});
