import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// Spec dedicado, sin precedente en este codebase (identity-document-owner-check.
// integration.spec.ts de Customers es el precedente mas cercano - prueba un CHECK, no una
// exclusion constraint GiST): prueba directamente contra Postgres real (Testcontainers) el
// constraint rates_no_overlapping_validity (INV-010/RN-20, docs/persistence/
// 07-MIGRACIONES.md SS3) - EXCLUDE USING gist (vehicle_category_id WITH =,
// tsrange(valid_from, valid_to, '[)') WITH &&). Corre con el rol migrator (exento de RLS,
// mismo criterio que el spec de Customers) - la exclusion constraint es una invariante de
// esquema, no de RLS.
describe('Exclusion constraint GiST de vigencia (rental.rates)', () => {
  let client: Client;
  let companyId: string;
  let categoryId: string;
  let existingRateId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();

    companyId = randomUUID();
    categoryId = randomUUID();
    existingRateId = randomUUID();

    await client.query(
      `INSERT INTO rental.vehicle_categories (id, company_id, name, updated_at, version)
       VALUES ($1, $2, 'Categoria GiST', now(), 1)`,
      [categoryId, companyId],
    );
    // Rate existente: vigente 2026-01-01 a 2026-06-01.
    await client.query(
      `INSERT INTO rental.rates (id, company_id, vehicle_category_id, amount_minor_units, currency, unit, valid_from, valid_to, updated_at)
       VALUES ($1, $2, $3, 50000, 'MXN', 'Day', '2026-01-01', '2026-06-01', now())`,
      [existingRateId, companyId, categoryId],
    );
  });

  afterAll(async () => {
    await client.query('DELETE FROM rental.rates WHERE vehicle_category_id = $1', [categoryId]);
    await client.query('DELETE FROM rental.vehicle_categories WHERE id = $1', [categoryId]);
    await client.end();
  });

  async function insertRate(params: { validFrom: string; validTo: string | null }): Promise<void> {
    await client.query(
      `INSERT INTO rental.rates (id, company_id, vehicle_category_id, amount_minor_units, currency, unit, valid_from, valid_to, updated_at)
       VALUES ($1, $2, $3, 60000, 'MXN', 'Day', $4, $5, now())`,
      [randomUUID(), companyId, categoryId, params.validFrom, params.validTo],
    );
  }

  it('rechaza una Rate cuya vigencia se solapa con la existente', async () => {
    await expect(insertRate({ validFrom: '2026-03-01', validTo: '2026-09-01' })).rejects.toThrow(
      /rates_no_overlapping_validity/,
    );
  });

  it('rechaza una Rate de vigencia abierta (validTo null) que se solapa con la existente', async () => {
    await expect(insertRate({ validFrom: '2026-05-01', validTo: null })).rejects.toThrow(
      /rates_no_overlapping_validity/,
    );
  });

  it('acepta una Rate con vigencia adyacente, no solapada (empieza justo cuando termina la anterior)', async () => {
    await expect(
      insertRate({ validFrom: '2026-06-01', validTo: '2026-12-01' }),
    ).resolves.not.toThrow();
  });

  it('acepta una Rate de otra vehicle_category_id con las mismas fechas (la exclusion es por categoria)', async () => {
    const otherCategoryId = randomUUID();
    await client.query(
      `INSERT INTO rental.vehicle_categories (id, company_id, name, updated_at, version)
       VALUES ($1, $2, 'Otra categoria', now(), 1)`,
      [otherCategoryId, companyId],
    );

    await expect(
      client.query(
        `INSERT INTO rental.rates (id, company_id, vehicle_category_id, amount_minor_units, currency, unit, valid_from, valid_to, updated_at)
         VALUES ($1, $2, $3, 60000, 'MXN', 'Day', '2026-03-01', '2026-09-01', now())`,
        [randomUUID(), companyId, otherCategoryId],
      ),
    ).resolves.not.toThrow();

    await client.query('DELETE FROM rental.rates WHERE vehicle_category_id = $1', [
      otherCategoryId,
    ]);
    await client.query('DELETE FROM rental.vehicle_categories WHERE id = $1', [otherCategoryId]);
  });
});
