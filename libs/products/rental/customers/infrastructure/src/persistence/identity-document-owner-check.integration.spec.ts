import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// Spec dedicado, sin precedente en este codebase: prueba directamente contra Postgres real
// (Testcontainers) el CHECK identity_documents_owner_exclusive_check (docs/persistence/
// 03-RELACIONES.md §5) - propietario polimorfico de identity_documents, exactamente una de
// customer_id/additional_driver_id poblada, nunca ambas ni ninguna. Corre con el rol
// migrator (exento de RLS, igual que el resto de los tests de integracion de este modulo) -
// el CHECK es una invariante de esquema, no de RLS, asi que probarlo directo con el
// migrator aisla la variable bajo prueba.
describe('CHECK de propietario polimorfico (rental.identity_documents)', () => {
  let client: Client;
  let companyId: string;
  let customerId: string;
  let driverId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();

    companyId = randomUUID();
    customerId = randomUUID();
    driverId = randomUUID();

    await client.query(
      `INSERT INTO rental.customers (id, company_id, name, tax_id_or_document_id, contact_email, contact_phone, customer_type, status, block_status, updated_at, version)
       VALUES ($1, $2, 'Cliente CHECK', 'DOC-CHECK', 'check@example.com', '+525500000003', 'Individual', 'Registered', 'None', now(), 1)`,
      [customerId, companyId],
    );
    await client.query(
      `INSERT INTO rental.additional_drivers (id, company_id, customer_id, name, status, updated_at, version)
       VALUES ($1, $2, $3, 'Conductor CHECK', 'Registered', now(), 1)`,
      [driverId, companyId, customerId],
    );
  });

  afterAll(async () => {
    await client.query('DELETE FROM rental.additional_drivers WHERE id = $1', [driverId]);
    await client.query('DELETE FROM rental.customers WHERE id = $1', [customerId]);
    await client.end();
  });

  async function insertDocument(params: {
    customerIdValue: string | null;
    additionalDriverIdValue: string | null;
  }): Promise<{ id: string }> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO rental.identity_documents (id, company_id, customer_id, additional_driver_id, document_type, file_id, expiry_date, status, updated_at)
       VALUES ($1, $2, $3, $4, 'NationalId', 'file-check', now() + interval '1 year', 'Pending', now())`,
      [id, companyId, params.customerIdValue, params.additionalDriverIdValue],
    );
    return { id };
  }

  it('rechaza un INSERT con AMBAS columnas de owner pobladas', async () => {
    await expect(
      insertDocument({ customerIdValue: customerId, additionalDriverIdValue: driverId }),
    ).rejects.toThrow(/identity_documents_owner_exclusive_check/);
  });

  it('rechaza un INSERT con NINGUNA columna de owner poblada', async () => {
    await expect(
      insertDocument({ customerIdValue: null, additionalDriverIdValue: null }),
    ).rejects.toThrow(/identity_documents_owner_exclusive_check/);
  });

  it('acepta un INSERT con solo customer_id poblado', async () => {
    const { id } = await insertDocument({
      customerIdValue: customerId,
      additionalDriverIdValue: null,
    });

    const result = await client.query(
      'SELECT customer_id, additional_driver_id FROM rental.identity_documents WHERE id = $1',
      [id],
    );
    expect(result.rows[0]).toEqual({ customer_id: customerId, additional_driver_id: null });

    await client.query('DELETE FROM rental.identity_documents WHERE id = $1', [id]);
  });

  it('acepta un INSERT con solo additional_driver_id poblado', async () => {
    const { id } = await insertDocument({
      customerIdValue: null,
      additionalDriverIdValue: driverId,
    });

    const result = await client.query(
      'SELECT customer_id, additional_driver_id FROM rental.identity_documents WHERE id = $1',
      [id],
    );
    expect(result.rows[0]).toEqual({ customer_id: null, additional_driver_id: driverId });

    await client.query('DELETE FROM rental.identity_documents WHERE id = $1', [id]);
  });
});
