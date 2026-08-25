// Fase 6/Hardening "load testing multi-tenant" (docs/persistence/10-DECISIONES.md #107).
// Borra por el mismo fingerprint "LoadTest-{companyIndex}"/"loadtest-{companyIndex}-" que
// setup.ts usa para taggear sus datos - sin esto, cada corrida deja companies/customers
// acumulandose en la DB de desarrollo persistente (a diferencia de los e2e, que corren
// contra un Postgres efimero de Testcontainers). Mismo DATABASE_URL/superusuario que
// setup.ts - bypassea RLS, no necesita SET LOCAL.
//
// Orden de borrado: hijos antes que padres (customers antes que companies; user_roles/users/
// roles antes que companies) - las FK son onDelete: Restrict en todo el modelo
// (docs/persistence/03-RELACIONES.md), un DELETE de companies primero fallaria.

import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv();

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const companies = await client.query<{ id: string }>(
      `SELECT id FROM organization.companies WHERE tax_id LIKE 'loadtest-%'`,
    );
    const companyIds = companies.rows.map((row) => row.id);

    if (companyIds.length === 0) {
      console.log('Nada que limpiar - ninguna company con tax_id loadtest-%.');
      return;
    }

    await client.query(`DELETE FROM rental.customers WHERE company_id = ANY($1)`, [companyIds]);
    await client.query(`DELETE FROM identity.user_roles WHERE company_id = ANY($1)`, [companyIds]);
    // setup.ts hace login real (crea una Session) - sessions referencia users con
    // onDelete: Restrict, tiene que borrarse antes.
    await client.query(`DELETE FROM identity.sessions WHERE company_id = ANY($1)`, [companyIds]);
    await client.query(`DELETE FROM identity.users WHERE company_id = ANY($1)`, [companyIds]);
    await client.query(`DELETE FROM identity.roles WHERE role_name LIKE 'LoadTest System Role %'`);
    await client.query(`DELETE FROM organization.company_settings WHERE company_id = ANY($1)`, [
      companyIds,
    ]);
    await client.query(`DELETE FROM organization.companies WHERE id = ANY($1)`, [companyIds]);

    console.log(`Limpieza completa: ${companyIds.length} companies de load-testing borradas.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
