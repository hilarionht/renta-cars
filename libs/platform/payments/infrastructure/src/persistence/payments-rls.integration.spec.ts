import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar (docs/persistence/06-RLS.md) para commerce.payments - primer uso real del
// schema commerce (docs/persistence/10-DECISIONES.md #68/#71) - mismo patron que
// availability-slots-rls.integration.spec.ts. Sin FKs reales que sembrar (target es
// polimorfico y opaco, docs/persistence/10-DECISIONES.md #4).
describe('Aislamiento de tenant via RLS y constraints de commerce.payments', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let paymentA: string;
  let paymentB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    paymentA = randomUUID();
    paymentB = randomUUID();

    await migratorClient.query(
      `INSERT INTO commerce.payments (id, company_id, target_type, target_id, amount_minor_units, amount_currency, method, status, idempotency_key, updated_at, version)
       VALUES
         ($1, $2, 'SecurityDeposit', $5, 50000, 'MXN', 'Cash', 'Requested', 'idem-a', now(), 1),
         ($3, $4, 'SecurityDeposit', $5, 50000, 'MXN', 'Cash', 'Requested', 'idem-b', now(), 1)`,
      [paymentA, companyA, paymentB, companyB, randomUUID()],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM commerce.payments WHERE id = ANY($1)', [
      [paymentA, paymentB],
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
      appRuntimeClient.query('SELECT id FROM commerce.payments WHERE id = ANY($1)', [
        [paymentA, paymentB],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([paymentA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM commerce.payments WHERE id = ANY($1)', [
        [paymentA, paymentB],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([paymentB]);
  });

  it('fail-closed: sin SET LOCAL, ninguna fila es visible (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const result = await isolatedClient.query(
        'SELECT id FROM commerce.payments WHERE id = ANY($1)',
        [[paymentA, paymentB]],
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('UNIQUE(company_id, idempotency_key) - INV-021: rechaza una segunda idempotency key repetida', async () => {
    const duplicateId = randomUUID();
    await expect(
      migratorClient.query(
        `INSERT INTO commerce.payments (id, company_id, target_type, target_id, amount_minor_units, amount_currency, method, status, idempotency_key, updated_at, version)
         VALUES ($1, $2, 'SecurityDeposit', $3, 50000, 'MXN', 'Cash', 'Requested', 'idem-a', now(), 1)`,
        [duplicateId, companyA, randomUUID()],
      ),
    ).rejects.toThrow(/payments_company_id_idempotency_key_key/);
  });

  it('la misma idempotency key SI se permite entre companies distintas', async () => {
    const otherCompanyId = randomUUID();
    const otherPaymentId = randomUUID();
    await migratorClient.query(
      `INSERT INTO commerce.payments (id, company_id, target_type, target_id, amount_minor_units, amount_currency, method, status, idempotency_key, updated_at, version)
       VALUES ($1, $2, 'SecurityDeposit', $3, 50000, 'MXN', 'Cash', 'Requested', 'idem-a', now(), 1)`,
      [otherPaymentId, otherCompanyId, randomUUID()],
    );
    await migratorClient.query('DELETE FROM commerce.payments WHERE id = $1', [otherPaymentId]);
  });
});
