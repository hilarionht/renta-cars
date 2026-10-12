import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar (docs/persistence/06-RLS.md) para las 7 tablas de rental.reservations -
// mismo patron que vehicles-rls.integration.spec.ts. Corre contra Postgres real
// (Testcontainers). Sin exclusion constraint que probar aca (Decision #8 - Reservation no
// tiene una propia).
describe('Aislamiento de tenant via RLS (rental.reservations y entidades internas)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;

  let companyA: string;
  let companyB: string;
  let customerA: string;
  let customerB: string;
  let categoryA: string;
  let categoryB: string;
  let vehicleA: string;
  let vehicleB: string;
  let additionalDriverA: string;
  let additionalDriverB: string;
  let reservationA: string;
  let reservationB: string;
  let inspectionA: string;
  let inspectionB: string;
  let inspectionPhotoA: string;
  let inspectionPhotoB: string;
  let damageReportA: string;
  let damageReportB: string;
  let damageReportPhotoA: string;
  let damageReportPhotoB: string;
  let priceAdjustmentA: string;
  let priceAdjustmentB: string;
  let authorizedDriverRowA: string;
  let authorizedDriverRowB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    customerA = randomUUID();
    customerB = randomUUID();
    categoryA = randomUUID();
    categoryB = randomUUID();
    vehicleA = randomUUID();
    vehicleB = randomUUID();
    additionalDriverA = randomUUID();
    additionalDriverB = randomUUID();
    reservationA = randomUUID();
    reservationB = randomUUID();
    inspectionA = randomUUID();
    inspectionB = randomUUID();
    inspectionPhotoA = randomUUID();
    inspectionPhotoB = randomUUID();
    damageReportA = randomUUID();
    damageReportB = randomUUID();
    damageReportPhotoA = randomUUID();
    damageReportPhotoB = randomUUID();
    priceAdjustmentA = randomUUID();
    priceAdjustmentB = randomUUID();
    authorizedDriverRowA = randomUUID();
    authorizedDriverRowB = randomUUID();

    await migratorClient.query(
      `INSERT INTO rental.customers (id, company_id, name, tax_id_or_document_id, contact_email, contact_phone, customer_type, status, block_status, updated_at, version)
       VALUES
         ($1, $2, 'Customer A', 'TAX-A', 'a@example.com', '+10000000000', 'Individual', 'Active', 'None', now(), 1),
         ($3, $4, 'Customer B', 'TAX-B', 'b@example.com', '+10000000001', 'Individual', 'Active', 'None', now(), 1)`,
      [customerA, companyA, customerB, companyB],
    );
    await migratorClient.query(
      `INSERT INTO rental.additional_drivers (id, company_id, customer_id, name, status, updated_at, version)
       VALUES
         ($1, $2, $3, 'Driver A', 'Validated', now(), 1),
         ($4, $5, $6, 'Driver B', 'Validated', now(), 1)`,
      [additionalDriverA, companyA, customerA, additionalDriverB, companyB, customerB],
    );
    await migratorClient.query(
      `INSERT INTO rental.vehicle_categories (id, company_id, name, updated_at, version)
       VALUES ($1, $2, 'Economico A', now(), 1), ($3, $4, 'Economico B', now(), 1)`,
      [categoryA, companyA, categoryB, companyB],
    );
    await migratorClient.query(
      `INSERT INTO rental.vehicles (id, company_id, branch_id, vehicle_category_id, license_plate, vin, status, updated_at, version)
       VALUES
         ($1, $2, $3, $4, 'RES-0001', '1HGCM82633A100001', 'Available', now(), 1),
         ($5, $6, $7, $8, 'RES-0002', '1HGCM82633A100002', 'Available', now(), 1)`,
      [vehicleA, companyA, randomUUID(), categoryA, vehicleB, companyB, randomUUID(), categoryB],
    );
    await migratorClient.query(
      `INSERT INTO rental.reservations (id, company_id, customer_id, vehicle_id, status, start_date, end_date, base_amount_minor_units, base_amount_currency, updated_at, version)
       VALUES
         ($1, $2, $3, $4, 'CheckedOut', now(), now() + interval '3 days', 15000, 'USD', now(), 1),
         ($5, $6, $7, $8, 'CheckedOut', now(), now() + interval '3 days', 15000, 'USD', now(), 1)`,
      [reservationA, companyA, customerA, vehicleA, reservationB, companyB, customerB, vehicleB],
    );
    await migratorClient.query(
      `INSERT INTO rental.reservation_authorized_drivers (id, company_id, reservation_id, additional_driver_id, created_at)
       VALUES ($1, $2, $3, $4, now()), ($5, $6, $7, $8, now())`,
      [
        authorizedDriverRowA,
        companyA,
        reservationA,
        additionalDriverA,
        authorizedDriverRowB,
        companyB,
        reservationB,
        additionalDriverB,
      ],
    );
    await migratorClient.query(
      `INSERT INTO rental.inspections (id, company_id, reservation_id, type, odometer, fuel_level, inspected_at, inspected_by, created_at)
       VALUES
         ($1, $2, $3, 'CheckOut', 1000, 100, now(), $4, now()),
         ($5, $6, $7, 'CheckOut', 1000, 100, now(), $8, now())`,
      [
        inspectionA,
        companyA,
        reservationA,
        randomUUID(),
        inspectionB,
        companyB,
        reservationB,
        randomUUID(),
      ],
    );
    await migratorClient.query(
      `INSERT INTO rental.inspection_photos (id, company_id, inspection_id, file_id, created_at)
       VALUES ($1, $2, $3, 'file-a', now()), ($4, $5, $6, 'file-b', now())`,
      [inspectionPhotoA, companyA, inspectionA, inspectionPhotoB, companyB, inspectionB],
    );
    await migratorClient.query(
      `INSERT INTO rental.damage_reports (id, company_id, reservation_id, inspection_id, description, severity, imputable_to_customer, created_at)
       VALUES
         ($1, $2, $3, $4, 'rayón', 'Minor', true, now()),
         ($5, $6, $7, $8, 'rayón', 'Minor', true, now())`,
      [
        damageReportA,
        companyA,
        reservationA,
        inspectionA,
        damageReportB,
        companyB,
        reservationB,
        inspectionB,
      ],
    );
    await migratorClient.query(
      `INSERT INTO rental.damage_report_photos (id, company_id, damage_report_id, file_id, created_at)
       VALUES ($1, $2, $3, 'file-a', now()), ($4, $5, $6, 'file-b', now())`,
      [damageReportPhotoA, companyA, damageReportA, damageReportPhotoB, companyB, damageReportB],
    );
    await migratorClient.query(
      `INSERT INTO rental.price_adjustments (id, company_id, reservation_id, kind, amount_minor_units, currency, created_at)
       VALUES
         ($1, $2, $3, 'DamagePenalty', 2000, 'USD', now()),
         ($4, $5, $6, 'DamagePenalty', 2000, 'USD', now())`,
      [priceAdjustmentA, companyA, reservationA, priceAdjustmentB, companyB, reservationB],
    );
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM rental.price_adjustments WHERE id = ANY($1)', [
      [priceAdjustmentA, priceAdjustmentB],
    ]);
    await migratorClient.query('DELETE FROM rental.damage_report_photos WHERE id = ANY($1)', [
      [damageReportPhotoA, damageReportPhotoB],
    ]);
    await migratorClient.query('DELETE FROM rental.damage_reports WHERE id = ANY($1)', [
      [damageReportA, damageReportB],
    ]);
    await migratorClient.query('DELETE FROM rental.inspection_photos WHERE id = ANY($1)', [
      [inspectionPhotoA, inspectionPhotoB],
    ]);
    await migratorClient.query('DELETE FROM rental.inspections WHERE id = ANY($1)', [
      [inspectionA, inspectionB],
    ]);
    await migratorClient.query(
      'DELETE FROM rental.reservation_authorized_drivers WHERE id = ANY($1)',
      [[authorizedDriverRowA, authorizedDriverRowB]],
    );
    await migratorClient.query('DELETE FROM rental.reservations WHERE id = ANY($1)', [
      [reservationA, reservationB],
    ]);
    await migratorClient.query('DELETE FROM rental.vehicles WHERE id = ANY($1)', [
      [vehicleA, vehicleB],
    ]);
    await migratorClient.query('DELETE FROM rental.vehicle_categories WHERE id = ANY($1)', [
      [categoryA, categoryB],
    ]);
    await migratorClient.query('DELETE FROM rental.additional_drivers WHERE id = ANY($1)', [
      [additionalDriverA, additionalDriverB],
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

  it.each([
    ['reservations', () => [reservationA, reservationB]],
    ['inspections', () => [inspectionA, inspectionB]],
    ['inspection_photos', () => [inspectionPhotoA, inspectionPhotoB]],
    ['damage_reports', () => [damageReportA, damageReportB]],
    ['damage_report_photos', () => [damageReportPhotoA, damageReportPhotoB]],
    ['price_adjustments', () => [priceAdjustmentA, priceAdjustmentB]],
    ['reservation_authorized_drivers', () => [authorizedDriverRowA, authorizedDriverRowB]],
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

  it('fail-closed: sin SET LOCAL, ninguna fila es visible en ninguna de las 7 tablas (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const checks: Array<[string, string[]]> = [
        ['reservations', [reservationA, reservationB]],
        ['inspections', [inspectionA, inspectionB]],
        ['inspection_photos', [inspectionPhotoA, inspectionPhotoB]],
        ['damage_reports', [damageReportA, damageReportB]],
        ['damage_report_photos', [damageReportPhotoA, damageReportPhotoB]],
        ['price_adjustments', [priceAdjustmentA, priceAdjustmentB]],
        ['reservation_authorized_drivers', [authorizedDriverRowA, authorizedDriverRowB]],
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
      appRuntimeClient.query("UPDATE rental.reservations SET status = 'CheckedIn' WHERE id = $1", [
        reservationA,
      ]),
    );

    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query('SELECT status FROM rental.reservations WHERE id = $1', [
        reservationA,
      ]),
    );
    expect(result.rows[0].status).toBe('CheckedIn');
  });

  it('UPDATE bajo el contexto de OTRA company no afecta la fila (invisible, no un error)', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query("UPDATE rental.reservations SET status = 'CheckedIn' WHERE id = $1", [
        reservationA,
      ]),
    );
    expect(result.rowCount).toBe(0);
  });
});
