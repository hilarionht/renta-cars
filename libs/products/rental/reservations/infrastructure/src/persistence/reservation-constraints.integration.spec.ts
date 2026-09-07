import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// Verifica los 2 constraints agregados a mano en la migracion (no expresables en el DSL de
// Prisma): CHECK(end_date > start_date) (RN-03/INV-001) y unique(reservation_id, type) en
// inspections (docs/persistence/05-INDICES-Y-CONSTRAINTS.md SS3). Confirma tambien,
// negativamente, que NO existe ningun exclusion constraint sobre reservations (Decision #8
// - la defensa en profundidad de INV-102 es AvailabilityService + la exclusion constraint
// de scheduling.availability_slots, nunca una tercera capa aca).
describe('Constraints de rental.reservations/inspections', () => {
  let client: Client;
  let companyId: string;
  let customerId: string;
  let categoryId: string;
  let vehicleId: string;
  let reservationId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();

    companyId = randomUUID();
    customerId = randomUUID();
    categoryId = randomUUID();
    vehicleId = randomUUID();
    reservationId = randomUUID();

    await client.query(
      `INSERT INTO rental.customers (id, company_id, name, tax_id_or_document_id, contact_email, contact_phone, customer_type, status, block_status, updated_at, version)
       VALUES ($1, $2, 'Customer', 'TAX-1', 'c@example.com', '+10000000000', 'Individual', 'Active', 'None', now(), 1)`,
      [customerId, companyId],
    );
    await client.query(
      `INSERT INTO rental.vehicle_categories (id, company_id, name, updated_at, version)
       VALUES ($1, $2, 'Economico', now(), 1)`,
      [categoryId, companyId],
    );
    await client.query(
      `INSERT INTO rental.vehicles (id, company_id, branch_id, vehicle_category_id, license_plate, vin, status, updated_at, version)
       VALUES ($1, $2, $3, $4, 'CON-0001', '1HGCM82633A200001', 'Available', now(), 1)`,
      [vehicleId, companyId, randomUUID(), categoryId],
    );
    await client.query(
      `INSERT INTO rental.reservations (id, company_id, customer_id, vehicle_id, status, start_date, end_date, base_amount_minor_units, base_amount_currency, updated_at, version)
       VALUES ($1, $2, $3, $4, 'CheckedOut', now(), now() + interval '3 days', 15000, 'USD', now(), 1)`,
      [reservationId, companyId, customerId, vehicleId],
    );
  });

  afterAll(async () => {
    await client.query('DELETE FROM rental.reservations WHERE id = $1', [reservationId]);
    await client.query('DELETE FROM rental.vehicles WHERE id = $1', [vehicleId]);
    await client.query('DELETE FROM rental.vehicle_categories WHERE id = $1', [categoryId]);
    await client.query('DELETE FROM rental.customers WHERE id = $1', [customerId]);
    await client.end();
  });

  it('CHECK(end_date > start_date): rechaza un rango invalido', async () => {
    const invalidId = randomUUID();
    await expect(
      client.query(
        `INSERT INTO rental.reservations (id, company_id, customer_id, vehicle_id, status, start_date, end_date, base_amount_minor_units, base_amount_currency, updated_at, version)
         VALUES ($1, $2, $3, $4, 'Draft', now(), now() - interval '1 day', 15000, 'USD', now(), 1)`,
        [invalidId, companyId, customerId, vehicleId],
      ),
    ).rejects.toThrow(/reservations_end_after_start_check/);
  });

  it('unique(reservation_id, type): rechaza una segunda Inspection CheckOut para la misma reservation', async () => {
    const firstId = randomUUID();
    await client.query(
      `INSERT INTO rental.inspections (id, company_id, reservation_id, type, odometer, fuel_level, inspected_at, inspected_by, created_at)
       VALUES ($1, $2, $3, 'CheckOut', 1000, 100, now(), $4, now())`,
      [firstId, companyId, reservationId, randomUUID()],
    );

    const secondId = randomUUID();
    await expect(
      client.query(
        `INSERT INTO rental.inspections (id, company_id, reservation_id, type, odometer, fuel_level, inspected_at, inspected_by, created_at)
         VALUES ($1, $2, $3, 'CheckOut', 1200, 90, now(), $4, now())`,
        [secondId, companyId, reservationId, randomUUID()],
      ),
    ).rejects.toThrow(/inspections_reservation_id_type_key/);

    await client.query('DELETE FROM rental.inspections WHERE id = $1', [firstId]);
  });

  it('no existe ningun exclusion constraint sobre rental.reservations (Decision #8)', async () => {
    const result = await client.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'rental.reservations'::regclass AND contype = 'x'`,
    );
    expect(result.rows).toHaveLength(0);
  });
});
