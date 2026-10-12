import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar (docs/persistence/06-RLS.md) para las 3 tablas de rental.customers - mismo
// patron que company-settings-rls.integration.spec.ts/files-rls.integration.spec.ts. Corre
// contra Postgres real (Testcontainers). El CHECK de propietario polimorfico de
// identity_documents se prueba aparte, en identity-document-owner-check.integration.spec.ts.
describe('Aislamiento de tenant via RLS (rental.customers/identity_documents/additional_drivers)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let customerA: string;
  let customerB: string;
  let documentA: string;
  let documentB: string;
  let driverA: string;
  let driverB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    customerA = randomUUID();
    customerB = randomUUID();
    documentA = randomUUID();
    documentB = randomUUID();
    driverA = randomUUID();
    driverB = randomUUID();

    await migratorClient.query(
      `INSERT INTO rental.customers (id, company_id, name, tax_id_or_document_id, contact_email, contact_phone, customer_type, status, block_status, updated_at, version)
       VALUES
         ($1, $2, 'Cliente A', 'DOC-A', 'a@example.com', '+525500000001', 'Individual', 'Registered', 'None', now(), 1),
         ($3, $4, 'Cliente B', 'DOC-B', 'b@example.com', '+525500000002', 'Individual', 'Registered', 'None', now(), 1)`,
      [customerA, companyA, customerB, companyB],
    );
    await migratorClient.query(
      `INSERT INTO rental.identity_documents (id, company_id, customer_id, document_type, file_id, expiry_date, status, updated_at)
       VALUES
         ($1, $2, $3, 'NationalId', 'file-a', now() + interval '1 year', 'Pending', now()),
         ($4, $5, $6, 'NationalId', 'file-b', now() + interval '1 year', 'Pending', now())`,
      [documentA, companyA, customerA, documentB, companyB, customerB],
    );
    await migratorClient.query(
      `INSERT INTO rental.additional_drivers (id, company_id, customer_id, name, status, updated_at, version)
       VALUES
         ($1, $2, $3, 'Conductor A', 'Registered', now(), 1),
         ($4, $5, $6, 'Conductor B', 'Registered', now(), 1)`,
      [driverA, companyA, customerA, driverB, companyB, customerB],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM rental.identity_documents WHERE id = ANY($1)', [
      [documentA, documentB],
    ]);
    await migratorClient.query('DELETE FROM rental.additional_drivers WHERE id = ANY($1)', [
      [driverA, driverB],
    ]);
    await migratorClient.query('DELETE FROM rental.customers WHERE id = ANY($1)', [
      [customerA, customerB],
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

  it('customers: aislamiento estandar por company_id en ambas direcciones', async () => {
    const fromA = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM rental.customers WHERE id = ANY($1)', [
        [customerA, customerB],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([customerA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM rental.customers WHERE id = ANY($1)', [
        [customerA, customerB],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([customerB]);
  });

  it('identity_documents: aislamiento estandar por company_id en ambas direcciones', async () => {
    const fromA = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM rental.identity_documents WHERE id = ANY($1)', [
        [documentA, documentB],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([documentA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM rental.identity_documents WHERE id = ANY($1)', [
        [documentA, documentB],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([documentB]);
  });

  it('additional_drivers: aislamiento estandar por company_id en ambas direcciones', async () => {
    const fromA = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT id FROM rental.additional_drivers WHERE id = ANY($1)', [
        [driverA, driverB],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([driverA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM rental.additional_drivers WHERE id = ANY($1)', [
        [driverA, driverB],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([driverB]);
  });

  it('fail-closed: sin SET LOCAL, ninguna fila es visible en ninguna de las 3 tablas (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const customers = await isolatedClient.query(
        'SELECT id FROM rental.customers WHERE id = ANY($1)',
        [[customerA, customerB]],
      );
      expect(customers.rows).toHaveLength(0);

      const documents = await isolatedClient.query(
        'SELECT id FROM rental.identity_documents WHERE id = ANY($1)',
        [[documentA, documentB]],
      );
      expect(documents.rows).toHaveLength(0);

      const drivers = await isolatedClient.query(
        'SELECT id FROM rental.additional_drivers WHERE id = ANY($1)',
        [[driverA, driverB]],
      );
      expect(drivers.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('app_runtime puede UPDATE una fila bajo su propio contexto de tenant, grant completo', async () => {
    await withCompanyContext(companyA, () =>
      appRuntimeClient.query("UPDATE rental.customers SET status = 'Active' WHERE id = $1", [
        customerA,
      ]),
    );

    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT status FROM rental.customers WHERE id = $1', [customerA]),
    );
    expect(result.rows[0].status).toBe('Active');
  });

  it('UPDATE bajo el contexto de OTRA company no afecta la fila (invisible, no un error)', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query("UPDATE rental.customers SET status = 'Active' WHERE id = $1", [
        customerA,
      ]),
    );
    expect(result.rowCount).toBe(0);
  });
});
