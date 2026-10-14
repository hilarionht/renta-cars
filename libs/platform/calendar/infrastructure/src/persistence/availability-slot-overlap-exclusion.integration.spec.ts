import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

// Spec dedicado, mismo espiritu que rate-overlap-exclusion.integration.spec.ts (Vehicles):
// prueba directamente contra Postgres real (Testcontainers) el constraint
// availability_slots_no_overlapping_active (INV-013/INV-102, docs/persistence/
// 07-MIGRACIONES.md SS3). A diferencia de la de `rates`, esta exclusion constraint es
// PARCIAL (WHERE status = 'Active') - el punto central que este spec prueba: dos slots
// solapados donde uno esta Released deben aceptarse, no rechazarse.
describe('Exclusion constraint parcial de disponibilidad (scheduling.availability_slots)', () => {
  let client: Client;
  let companyId: string;
  let resourceId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();
    companyId = randomUUID();
    resourceId = randomUUID();
  });

  afterAll(async () => {
    await client.query(
      'DELETE FROM scheduling.availability_slots WHERE company_id = $1 AND resource_id = $2',
      [companyId, resourceId],
    );
    await client.end();
  });

  async function insertSlot(params: {
    startDate: string;
    endDate: string;
    status: 'Active' | 'Released';
    resourceIdOverride?: string;
  }): Promise<string> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO scheduling.availability_slots (id, company_id, resource_type, resource_id, start_date, end_date, slot_type, reason, status, updated_at, version)
       VALUES ($1, $2, 'vehicle', $3, $4, $5, 'Blackout', 'test', $6, now(), 1)`,
      [
        id,
        companyId,
        params.resourceIdOverride ?? resourceId,
        params.startDate,
        params.endDate,
        params.status,
      ],
    );
    return id;
  }

  it('rechaza dos slots Active del mismo recurso con vigencias solapadas', async () => {
    await insertSlot({ startDate: '2026-01-01', endDate: '2026-01-10', status: 'Active' });

    await expect(
      insertSlot({ startDate: '2026-01-05', endDate: '2026-01-15', status: 'Active' }),
    ).rejects.toThrow(/availability_slots_no_overlapping_active/);
  });

  it('acepta dos slots solapados cuando uno esta Released - la condicion parcial es el punto central', async () => {
    await insertSlot({ startDate: '2026-02-01', endDate: '2026-02-10', status: 'Released' });

    await expect(
      insertSlot({ startDate: '2026-02-05', endDate: '2026-02-15', status: 'Active' }),
    ).resolves.toBeDefined();
  });

  it('acepta dos slots Active del mismo recurso con vigencias no solapadas', async () => {
    await insertSlot({ startDate: '2026-03-01', endDate: '2026-03-10', status: 'Active' });

    await expect(
      insertSlot({ startDate: '2026-03-10', endDate: '2026-03-20', status: 'Active' }),
    ).resolves.toBeDefined();
  });

  it('acepta dos slots Active con las mismas fechas pero recursos distintos', async () => {
    await insertSlot({ startDate: '2026-04-01', endDate: '2026-04-10', status: 'Active' });

    await expect(
      insertSlot({
        startDate: '2026-04-01',
        endDate: '2026-04-10',
        status: 'Active',
        resourceIdOverride: randomUUID(),
      }),
    ).resolves.toBeDefined();
  });

  // docs/persistence/10-DECISIONES.md #136: la secuencia de MoveSlotHandler (liberar el slot
  // viejo y DESPUES insertar el nuevo, en una sola transaccion). La exclusion se evalua fila a
  // fila (no es DEFERRABLE), asi que el viejo ya Released no choca con el nuevo superpuesto.
  async function moveInTransaction(oldSlotId: string, startDate: string, endDate: string) {
    await client.query('BEGIN');
    try {
      await client.query(
        "UPDATE scheduling.availability_slots SET status = 'Released' WHERE id = $1",
        [oldSlotId],
      );
      const newId = await insertSlot({ startDate, endDate, status: 'Active' });
      await client.query('COMMIT');
      return newId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  async function statusOf(id: string): Promise<string> {
    const result = await client.query<{ status: string }>(
      'SELECT status FROM scheduling.availability_slots WHERE id = $1',
      [id],
    );
    return result.rows[0].status;
  }

  it('mover a un rango superpuesto al propio (extension) se acepta en una transaccion', async () => {
    const oldId = await insertSlot({
      startDate: '2026-05-01',
      endDate: '2026-05-10',
      status: 'Active',
    });

    const newId = await moveInTransaction(oldId, '2026-05-01', '2026-05-15');

    expect(await statusOf(oldId)).toBe('Released');
    expect(await statusOf(newId)).toBe('Active');
  });

  it('si el rango nuevo choca con OTRO slot, la transaccion vuelve atras y el viejo sigue Active', async () => {
    const oldId = await insertSlot({
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      status: 'Active',
    });
    await insertSlot({ startDate: '2026-06-12', endDate: '2026-06-20', status: 'Active' });

    await expect(moveInTransaction(oldId, '2026-06-01', '2026-06-15')).rejects.toThrow(
      /availability_slots_no_overlapping_active/,
    );
    expect(await statusOf(oldId)).toBe('Active');
  });
});
