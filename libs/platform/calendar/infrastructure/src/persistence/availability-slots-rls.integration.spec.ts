import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar (docs/persistence/06-RLS.md) para scheduling.availability_slots - mismo
// patron que customers-rls/vehicles-rls.integration.spec.ts. Corre contra Postgres real
// (Testcontainers). La exclusion constraint parcial se prueba aparte, en
// availability-slot-overlap-exclusion.integration.spec.ts.
describe('Aislamiento de tenant via RLS (scheduling.availability_slots)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let slotA: string;
  let slotB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    slotA = randomUUID();
    slotB = randomUUID();

    await migratorClient.query(
      `INSERT INTO scheduling.availability_slots (id, company_id, resource_type, resource_id, start_date, end_date, slot_type, reason, status, updated_at, version)
       VALUES
         ($1, $2, 'vehicle', 'vehicle-a', '2026-01-01', '2026-01-10', 'Blackout', 'mantenimiento', 'Active', now(), 1),
         ($3, $4, 'vehicle', 'vehicle-b', '2026-01-01', '2026-01-10', 'Blackout', 'mantenimiento', 'Active', now(), 1)`,
      [slotA, companyA, slotB, companyB],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM scheduling.availability_slots WHERE id = ANY($1)', [
      [slotA, slotB],
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
      appRuntimeClient.query('SELECT id FROM scheduling.availability_slots WHERE id = ANY($1)', [
        [slotA, slotB],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([slotA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM scheduling.availability_slots WHERE id = ANY($1)', [
        [slotA, slotB],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([slotB]);
  });

  it('fail-closed: sin SET LOCAL, ninguna fila es visible (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const result = await isolatedClient.query(
        'SELECT id FROM scheduling.availability_slots WHERE id = ANY($1)',
        [[slotA, slotB]],
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('app_runtime puede UPDATE una fila bajo su propio contexto de tenant, grant completo', async () => {
    await withCompanyContext(companyA, () =>
      appRuntimeClient.query(
        "UPDATE scheduling.availability_slots SET status = 'Released' WHERE id = $1",
        [slotA],
      ),
    );

    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT status FROM scheduling.availability_slots WHERE id = $1', [
        slotA,
      ]),
    );
    expect(result.rows[0].status).toBe('Released');
  });

  it('UPDATE bajo el contexto de OTRA company no afecta la fila (invisible, no un error)', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query(
        "UPDATE scheduling.availability_slots SET status = 'Released' WHERE id = $1",
        [slotA],
      ),
    );
    expect(result.rowCount).toBe(0);
  });
});
