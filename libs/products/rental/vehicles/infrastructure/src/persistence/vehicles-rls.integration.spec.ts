import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar (docs/persistence/06-RLS.md) para las 5 tablas de rental.vehicles - mismo
// patron que customers-rls.integration.spec.ts. Corre contra Postgres real (Testcontainers).
// La exclusion constraint GiST de rates se prueba aparte, en
// rate-overlap-exclusion.integration.spec.ts.
describe('Aislamiento de tenant via RLS (rental.vehicles/vehicle_categories/vehicle_documents/maintenance_records/rates)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let categoryA: string;
  let categoryB: string;
  let rateA: string;
  let rateB: string;
  let vehicleA: string;
  let vehicleB: string;
  let documentA: string;
  let documentB: string;
  let maintenanceA: string;
  let maintenanceB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    categoryA = randomUUID();
    categoryB = randomUUID();
    rateA = randomUUID();
    rateB = randomUUID();
    vehicleA = randomUUID();
    vehicleB = randomUUID();
    documentA = randomUUID();
    documentB = randomUUID();
    maintenanceA = randomUUID();
    maintenanceB = randomUUID();

    await migratorClient.query(
      `INSERT INTO rental.vehicle_categories (id, company_id, name, updated_at, version)
       VALUES ($1, $2, 'Economico A', now(), 1), ($3, $4, 'Economico B', now(), 1)`,
      [categoryA, companyA, categoryB, companyB],
    );
    await migratorClient.query(
      `INSERT INTO rental.rates (id, company_id, vehicle_category_id, amount_minor_units, currency, unit, valid_from, updated_at)
       VALUES
         ($1, $2, $3, 50000, 'MXN', 'Day', now(), now()),
         ($4, $5, $6, 50000, 'MXN', 'Day', now(), now())`,
      [rateA, companyA, categoryA, rateB, companyB, categoryB],
    );
    await migratorClient.query(
      `INSERT INTO rental.vehicles (id, company_id, branch_id, vehicle_category_id, license_plate, vin, status, updated_at, version)
       VALUES
         ($1, $2, $3, $4, 'AAA-0001', '1HGCM82633A000001', 'Registered', now(), 1),
         ($5, $6, $7, $8, 'BBB-0002', '1HGCM82633A000002', 'Registered', now(), 1)`,
      [vehicleA, companyA, randomUUID(), categoryA, vehicleB, companyB, randomUUID(), categoryB],
    );
    await migratorClient.query(
      `INSERT INTO rental.vehicle_documents (id, company_id, vehicle_id, document_type, file_id, expiry_date, status, updated_at)
       VALUES
         ($1, $2, $3, 'PropertyCard', 'file-a', now() + interval '1 year', 'Pending', now()),
         ($4, $5, $6, 'PropertyCard', 'file-b', now() + interval '1 year', 'Pending', now())`,
      [documentA, companyA, vehicleA, documentB, companyB, vehicleB],
    );
    await migratorClient.query(
      `INSERT INTO rental.maintenance_records (id, company_id, vehicle_id, type, status, scheduled_start, scheduled_end, updated_at)
       VALUES
         ($1, $2, $3, 'Preventive', 'Scheduled', now(), now() + interval '1 day', now()),
         ($4, $5, $6, 'Preventive', 'Scheduled', now(), now() + interval '1 day', now())`,
      [maintenanceA, companyA, vehicleA, maintenanceB, companyB, vehicleB],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM rental.maintenance_records WHERE id = ANY($1)', [
      [maintenanceA, maintenanceB],
    ]);
    await migratorClient.query('DELETE FROM rental.vehicle_documents WHERE id = ANY($1)', [
      [documentA, documentB],
    ]);
    await migratorClient.query('DELETE FROM rental.vehicles WHERE id = ANY($1)', [
      [vehicleA, vehicleB],
    ]);
    await migratorClient.query('DELETE FROM rental.rates WHERE id = ANY($1)', [[rateA, rateB]]);
    await migratorClient.query('DELETE FROM rental.vehicle_categories WHERE id = ANY($1)', [
      [categoryA, categoryB],
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

  it.each([
    ['vehicle_categories', () => [categoryA, categoryB]],
    ['rates', () => [rateA, rateB]],
    ['vehicles', () => [vehicleA, vehicleB]],
    ['vehicle_documents', () => [documentA, documentB]],
    ['maintenance_records', () => [maintenanceA, maintenanceB]],
  ] as const)(
    '%s: aislamiento estandar por company_id en ambas direcciones',
    async (table, ids) => {
      const [idA, idB] = ids();

      const fromA = await withCompanyContext(companyA, () =>
        appRuntimeClient.query(`SELECT id FROM rental.${table} WHERE id = ANY($1)`, [[idA, idB]]),
      );
      expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([idA]);

      const fromB = await withCompanyContext(companyB, () =>
        appRuntimeClient.query(`SELECT id FROM rental.${table} WHERE id = ANY($1)`, [[idA, idB]]),
      );
      expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([idB]);
    },
  );

  it('fail-closed: sin SET LOCAL, ninguna fila es visible en ninguna de las 5 tablas (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const checks: Array<[string, string[]]> = [
        ['vehicle_categories', [categoryA, categoryB]],
        ['rates', [rateA, rateB]],
        ['vehicles', [vehicleA, vehicleB]],
        ['vehicle_documents', [documentA, documentB]],
        ['maintenance_records', [maintenanceA, maintenanceB]],
      ];
      for (const [table, ids] of checks) {
        const result = await isolatedClient.query(
          `SELECT id FROM rental.${table} WHERE id = ANY($1)`,
          [ids],
        );
        expect(result.rows).toHaveLength(0);
      }
    } finally {
      await isolatedClient.end();
    }
  });

  it('app_runtime puede UPDATE una fila bajo su propio contexto de tenant, grant completo', async () => {
    await withCompanyContext(companyA, () =>
      appRuntimeClient.query("UPDATE rental.vehicles SET status = 'Available' WHERE id = $1", [
        vehicleA,
      ]),
    );

    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT status FROM rental.vehicles WHERE id = $1', [vehicleA]),
    );
    expect(result.rows[0].status).toBe('Available');
  });

  it('UPDATE bajo el contexto de OTRA company no afecta la fila (invisible, no un error)', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query("UPDATE rental.vehicles SET status = 'Available' WHERE id = $1", [
        vehicleA,
      ]),
    );
    expect(result.rowCount).toBe(0);
  });
});
