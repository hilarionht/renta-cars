import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar (docs/persistence/06-RLS.md) para commerce.security_deposits, mismo patron que
// payments-rls.integration.spec.ts. Sin FK real hacia reservations (Commerce es 100%
// event-driven respecto de Rental Operations, docs/model/09-DEPENDENCIES.md SS2/SS3).
describe('Aislamiento de tenant via RLS y constraints de commerce.security_deposits', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let depositA: string;
  let depositB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    depositA = randomUUID();
    depositB = randomUUID();
    const reservationIdA = randomUUID();
    const reservationIdB = randomUUID();

    await migratorClient.query(
      `INSERT INTO commerce.security_deposits (id, company_id, reservation_id, amount_minor_units, amount_currency, status, updated_at, version)
       VALUES
         ($1, $2, $3, 50000, 'MXN', 'Held', now(), 1),
         ($4, $5, $6, 50000, 'MXN', 'Held', now(), 1)`,
      [depositA, companyA, reservationIdA, depositB, companyB, reservationIdB],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM commerce.security_deposits WHERE id = ANY($1)', [
      [depositA, depositB],
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
      appRuntimeClient.query('SELECT id FROM commerce.security_deposits WHERE id = ANY($1)', [
        [depositA, depositB],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([depositA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM commerce.security_deposits WHERE id = ANY($1)', [
        [depositA, depositB],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([depositB]);
  });

  it('fail-closed: sin SET LOCAL, ninguna fila es visible (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const result = await isolatedClient.query(
        'SELECT id FROM commerce.security_deposits WHERE id = ANY($1)',
        [[depositA, depositB]],
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('UNIQUE(company_id, reservation_id) - a lo sumo un deposit por reservation', async () => {
    const reservationResult = await migratorClient.query(
      'SELECT reservation_id FROM commerce.security_deposits WHERE id = $1',
      [depositA],
    );
    const reservationId = reservationResult.rows[0].reservation_id as string;

    const duplicateId = randomUUID();
    await expect(
      migratorClient.query(
        `INSERT INTO commerce.security_deposits (id, company_id, reservation_id, amount_minor_units, amount_currency, status, updated_at, version)
         VALUES ($1, $2, $3, 20000, 'MXN', 'Held', now(), 1)`,
        [duplicateId, companyA, reservationId],
      ),
    ).rejects.toThrow(/security_deposits_company_id_reservation_id_key/);
  });

  it('CHECK INV-019: rechaza retained_amount_minor_units > amount_minor_units', async () => {
    await expect(
      migratorClient.query(
        `UPDATE commerce.security_deposits SET retained_amount_minor_units = 60000 WHERE id = $1`,
        [depositA],
      ),
    ).rejects.toThrow(/security_deposits_retained_amount_within_held_check/);
  });

  it('CHECK INV-019: acepta retained_amount_minor_units <= amount_minor_units', async () => {
    await migratorClient.query(
      `UPDATE commerce.security_deposits SET retained_amount_minor_units = 50000, status = 'RetainedFully' WHERE id = $1`,
      [depositA],
    );
    const result = await migratorClient.query(
      'SELECT retained_amount_minor_units FROM commerce.security_deposits WHERE id = $1',
      [depositA],
    );
    expect(result.rows[0].retained_amount_minor_units).toBe(50000);
  });
});
