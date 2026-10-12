import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// RLS estandar de organization.company_settings (docs/persistence/06-RLS.md) - mismo patron
// que libs/platform/companies/infrastructure/.../tenant-isolation.integration.spec.ts y
// libs/platform/files/infrastructure/.../files-rls.integration.spec.ts. Corre contra
// Postgres real (Testcontainers). company_id es la propia PK aca (sin columna id separada,
// docs/persistence/04-COLUMNAS-CONCEPTUALES.md SS4) - no es un caso especial de
// auto-comparacion como organization.companies (esa politica compara su propio id;
// company_settings.company_id es una columna normal, aunque tambien sea la PK).
describe('Aislamiento de tenant via RLS (organization.company_settings)', () => {
  let migratorClient: Client;
  let appRuntimeClient: Client;
  let companyA: string;
  let companyB: string;

  beforeAll(async () => {
    migratorClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await migratorClient.connect();
    appRuntimeClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await appRuntimeClient.connect();

    companyA = randomUUID();
    companyB = randomUUID();

    await migratorClient.query(
      `INSERT INTO organization.company_settings (
         company_id, enabled_product_modules, payment_methods_enabled,
         cancellation_policy_tiers, late_return_grace_minutes, late_return_penalty_pct_per_hour,
         deposit_applies, deposit_percentage_of_total, draft_expiration_minutes,
         minimum_booking_lead_time_minutes, updated_at, version
       )
       VALUES
         ($1, ARRAY['Rental'], ARRAY['Card','Cash','Transfer','DigitalWallet']::"organization"."PaymentMethod"[],
          '[{"minHoursBeforeStart":0,"penaltyPercentage":0}]'::jsonb, 30, 10, false, 0, 1440, 0, now(), 1),
         ($2, ARRAY['Rental'], ARRAY['Card','Cash','Transfer','DigitalWallet']::"organization"."PaymentMethod"[],
          '[{"minHoursBeforeStart":0,"penaltyPercentage":0}]'::jsonb, 30, 10, false, 0, 1440, 0, now(), 1)`,
      [companyA, companyB],
    );
  });

  afterAll(async () => {
    await migratorClient.query(
      'DELETE FROM organization.company_settings WHERE company_id = ANY($1)',
      [[companyA, companyB]],
    );
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
      appRuntimeClient.query(
        'SELECT company_id FROM organization.company_settings WHERE company_id = ANY($1)',
        [[companyA, companyB]],
      ),
    );
    expect(fromA.rows.map((row: { company_id: string }) => row.company_id)).toEqual([companyA]);

    const fromB = await withCompanyContext(companyB, () =>
      appRuntimeClient.query(
        'SELECT company_id FROM organization.company_settings WHERE company_id = ANY($1)',
        [[companyA, companyB]],
      ),
    );
    expect(fromB.rows.map((row: { company_id: string }) => row.company_id)).toEqual([companyB]);
  });

  it('fail-closed: sin SET LOCAL, ninguna fila es visible (nunca un error)', async () => {
    const isolatedClient = new Client({ connectionString: process.env.TEST_APP_DATABASE_URL });
    await isolatedClient.connect();
    try {
      const result = await isolatedClient.query(
        'SELECT company_id FROM organization.company_settings WHERE company_id = ANY($1)',
        [[companyA, companyB]],
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await isolatedClient.end();
    }
  });

  it('app_runtime puede UPDATE una fila bajo su propio contexto de tenant (grant completo, no restringido como audit_log)', async () => {
    await withCompanyContext(companyA, () =>
      appRuntimeClient.query(
        'UPDATE organization.company_settings SET payment_methods_enabled = ARRAY[\'Cash\']::"organization"."PaymentMethod"[] WHERE company_id = $1',
        [companyA],
      ),
    );

    const result = await withCompanyContext(companyA, () =>
      appRuntimeClient.query(
        'SELECT payment_methods_enabled FROM organization.company_settings WHERE company_id = $1',
        [companyA],
      ),
    );
    // pg no parsea automaticamente un arreglo de un enum custom (solo los tipos array
    // nativos como text[]) - llega como el literal crudo de Postgres, no un array de JS.
    // Prisma si lo maneja correctamente (confirmado por el smoke test real via la app).
    expect(result.rows[0].payment_methods_enabled).toBe('{Cash}');
  });

  it('UPDATE bajo el contexto de OTRA company no afecta la fila (invisible, no un error)', async () => {
    const result = await withCompanyContext(companyB, () =>
      appRuntimeClient.query(
        'UPDATE organization.company_settings SET payment_methods_enabled = ARRAY[\'Cash\']::"organization"."PaymentMethod"[] WHERE company_id = $1',
        [companyA],
      ),
    );
    expect(result.rowCount).toBe(0);
  });
});
