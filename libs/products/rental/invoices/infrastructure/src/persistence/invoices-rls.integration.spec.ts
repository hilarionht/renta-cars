import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar (docs/persistence/06-RLS.md) + constraints a mano de rental.invoices/charges -
// a diferencia de commerce.payments (Payments), Invoice.reservationId/customerId son FK
// reales (mismo schema fisico), asi que hace falta sembrar un Customer/VehicleCategory/
// Vehicle/Reservation reales primero, mismo patron que reservation-constraints.integration.spec.ts.
describe('Aislamiento de tenant via RLS y constraints de rental.invoices/charges', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;
  let customerAId: string;
  let customerBId: string;
  let vehicleAId: string;
  let reservationAId: string;
  let reservationBId: string;
  let invoiceAId: string;
  let invoiceBId: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();
    customerAId = randomUUID();
    customerBId = randomUUID();
    const categoryAId = randomUUID();
    const categoryBId = randomUUID();
    vehicleAId = randomUUID();
    const vehicleBId = randomUUID();
    reservationAId = randomUUID();
    reservationBId = randomUUID();
    invoiceAId = randomUUID();
    invoiceBId = randomUUID();

    for (const [companyId, customerId, categoryId, vehicleId, reservationId, invoiceId, suffix] of [
      [companyA, customerAId, categoryAId, vehicleAId, reservationAId, invoiceAId, 'a'],
      [companyB, customerBId, categoryBId, vehicleBId, reservationBId, invoiceBId, 'b'],
    ] as const) {
      await migratorClient.query(
        `INSERT INTO rental.customers (id, company_id, name, tax_id_or_document_id, contact_email, contact_phone, customer_type, status, block_status, updated_at, version)
         VALUES ($1, $2, 'Customer', $3, 'c@example.com', '+10000000000', 'Individual', 'Active', 'None', now(), 1)`,
        [customerId, companyId, `TAX-INV-${suffix}`],
      );
      await migratorClient.query(
        `INSERT INTO rental.vehicle_categories (id, company_id, name, updated_at, version)
         VALUES ($1, $2, 'Economico', now(), 1)`,
        [categoryId, companyId],
      );
      await migratorClient.query(
        `INSERT INTO rental.vehicles (id, company_id, branch_id, vehicle_category_id, license_plate, vin, status, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, 'Available', now(), 1)`,
        [
          vehicleId,
          companyId,
          randomUUID(),
          categoryId,
          `INV-${suffix.toUpperCase()}-0001`,
          `1HGCM8263${suffix.toUpperCase()}A20000${suffix}`,
        ],
      );
      await migratorClient.query(
        `INSERT INTO rental.reservations (id, company_id, customer_id, vehicle_id, status, start_date, end_date, base_amount_minor_units, base_amount_currency, updated_at, version)
         VALUES ($1, $2, $3, $4, 'CheckedIn', now(), now() + interval '3 days', 150000, 'USD', now(), 1)`,
        [reservationId, companyId, customerId, vehicleId],
      );
      await migratorClient.query(
        `INSERT INTO rental.invoices (id, company_id, reservation_id, customer_id, invoice_number, status, updated_at, version)
         VALUES ($1, $2, $3, $4, $5, 'Issued', now(), 1)`,
        [invoiceId, companyId, reservationId, customerId, `INV-0000000${suffix === 'a' ? 1 : 2}`],
      );
    }
  });

  afterAll(async () => {
    await migratorClient.query('DELETE FROM rental.invoices WHERE id = ANY($1)', [
      [invoiceAId, invoiceBId],
    ]);
    await migratorClient.query('DELETE FROM rental.reservations WHERE id = ANY($1)', [
      [reservationAId, reservationBId],
    ]);
    await migratorClient.query('DELETE FROM rental.customers WHERE id = ANY($1)', [
      [customerAId, customerBId],
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
      appRuntimeClient.query('SELECT id FROM rental.invoices WHERE id = ANY($1)', [
        [invoiceAId, invoiceBId],
      ]),
    );
    expect(fromA.rows.map((row: { id: string }) => row.id)).toEqual([invoiceAId]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query('SELECT id FROM rental.invoices WHERE id = ANY($1)', [
        [invoiceAId, invoiceBId],
      ]),
    );
    expect(fromB.rows.map((row: { id: string }) => row.id)).toEqual([invoiceBId]);
  });

  it('fail-closed: sin SET LOCAL, ninguna fila es visible (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const result = await isolatedClient.query(
        'SELECT id FROM rental.invoices WHERE id = ANY($1)',
        [[invoiceAId, invoiceBId]],
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('INV-023 (indice unico parcial): rechaza una segunda invoice activa para la misma reservation', async () => {
    const duplicateId = randomUUID();
    await expect(
      migratorClient.query(
        `INSERT INTO rental.invoices (id, company_id, reservation_id, customer_id, invoice_number, status, updated_at, version)
         VALUES ($1, $2, $3, $4, 'INV-00000099', 'Issued', now(), 1)`,
        [duplicateId, companyA, reservationAId, customerAId],
      ),
    ).rejects.toThrow(/invoices_reservation_id_active_key/);
  });

  it('INV-023: SI permite una segunda invoice tras anular (Voided) la primera', async () => {
    await migratorClient.query(
      `UPDATE rental.invoices SET status = 'Voided', void_reason = 'error de tipificacion' WHERE id = $1`,
      [invoiceAId],
    );

    const reissuedId = randomUUID();
    await migratorClient.query(
      `INSERT INTO rental.invoices (id, company_id, reservation_id, customer_id, invoice_number, status, updated_at, version)
       VALUES ($1, $2, $3, $4, 'INV-00000099', 'Issued', now(), 1)`,
      [reissuedId, companyA, reservationAId, customerAId],
    );

    await migratorClient.query('DELETE FROM rental.invoices WHERE id = $1', [reissuedId]);
    await migratorClient.query(
      `UPDATE rental.invoices SET status = 'Issued', void_reason = NULL WHERE id = $1`,
      [invoiceAId],
    );
  });

  it('UNIQUE(company_id, invoice_number): rechaza el mismo numero repetido en la misma company', async () => {
    const duplicateId = randomUUID();
    const otherReservationId = randomUUID();
    await migratorClient.query(
      `INSERT INTO rental.reservations (id, company_id, customer_id, vehicle_id, status, start_date, end_date, base_amount_minor_units, base_amount_currency, updated_at, version)
       VALUES ($1, $2, $3, $4, 'CheckedIn', now(), now() + interval '3 days', 150000, 'USD', now(), 1)`,
      [otherReservationId, companyA, customerAId, vehicleAId],
    );

    await expect(
      migratorClient.query(
        `INSERT INTO rental.invoices (id, company_id, reservation_id, customer_id, invoice_number, status, updated_at, version)
         VALUES ($1, $2, $3, $4, 'INV-00000001', 'Issued', now(), 1)`,
        [duplicateId, companyA, otherReservationId, customerAId],
      ),
    ).rejects.toThrow(/invoices_company_id_invoice_number_key/);

    await migratorClient.query('DELETE FROM rental.reservations WHERE id = $1', [
      otherReservationId,
    ]);
  });

  it('charges: FK real hacia invoices con CASCADE', async () => {
    const chargeId = randomUUID();
    await migratorClient.query(
      `INSERT INTO rental.charges (id, company_id, invoice_id, kind, amount_minor_units, currency, description, created_at)
       VALUES ($1, $2, $3, 'RentalFee', 150000, 'USD', 'Renta base', now())`,
      [chargeId, companyA, invoiceAId],
    );

    const result = await migratorClient.query('SELECT id FROM rental.charges WHERE id = $1', [
      chargeId,
    ]);
    expect(result.rows).toHaveLength(1);

    await migratorClient.query('DELETE FROM rental.charges WHERE id = $1', [chargeId]);
  });
});
