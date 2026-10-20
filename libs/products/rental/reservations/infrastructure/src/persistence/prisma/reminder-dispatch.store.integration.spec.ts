import { randomUUID } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import { Client } from 'pg';

import { PrismaService, PrismaUnitOfWork, type RequestContext } from '@platform/persistence-kernel';

import { REMINDER_STALE_SENDING_MS, ReminderDispatchStore } from './reminder-dispatch.store';

// docs/persistence/10-DECISIONES.md #145, contra Postgres real: el reclamo de un intento del
// recordatorio bajo concurrencia, el tope de 3 intentos, el Sending colgado y que un intento
// viejo no pise el estado del siguiente. Ningun unitario puede comprobar ON CONFLICT ni el
// UPDATE condicional reevaluado en READ COMMITTED.
describe('ReminderDispatchStore (Postgres real, #145)', () => {
  let client: Client;
  let prisma: PrismaService;
  let store: ReminderDispatchStore;
  const companyId = randomUUID();
  const customerId = randomUUID();
  const categoryId = randomUUID();
  const vehicleId = randomUUID();
  const reservationIds: string[] = [];

  async function newReservation(): Promise<string> {
    const id = randomUUID();
    reservationIds.push(id);
    const offsetDays = reservationIds.length * 3;
    await client.query(
      `INSERT INTO rental.reservations (id, company_id, customer_id, vehicle_id, status, start_date, end_date, base_amount_minor_units, base_amount_currency, updated_at, version)
       VALUES ($1, $2, $3, $4, 'Confirmed', now() + ($5 || ' days')::interval, now() + ($6 || ' days')::interval, 15000, 'USD', now(), 1)`,
      [id, companyId, customerId, vehicleId, String(offsetDays), String(offsetDays + 1)],
    );
    return id;
  }

  async function dispatchOf(reservationId: string) {
    const result = await client.query<{
      status: string;
      attempts: number;
      last_error: string | null;
    }>(
      'SELECT status, attempts, last_error FROM rental.reservation_reminder_dispatches WHERE reservation_id = $1',
      [reservationId],
    );
    return result.rows[0];
  }

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();
    await client.query(
      `INSERT INTO rental.customers (id, company_id, name, tax_id_or_document_id, contact_email, contact_phone, customer_type, status, block_status, updated_at, version)
       VALUES ($1, $2, 'Customer', $3, 'c@example.com', '+10000000001', 'Individual', 'Active', 'None', now(), 1)`,
      [customerId, companyId, `TAX-${customerId.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO rental.vehicle_categories (id, company_id, name, updated_at, version)
       VALUES ($1, $2, 'Economico', now(), 1)`,
      [categoryId, companyId],
    );
    await client.query(
      `INSERT INTO rental.vehicles (id, company_id, branch_id, vehicle_category_id, license_plate, vin, status, updated_at, version)
       VALUES ($1, $2, $3, $4, $5, $6, 'Available', now(), 1)`,
      [
        vehicleId,
        companyId,
        randomUUID(),
        categoryId,
        `RD-${vehicleId.slice(0, 6)}`,
        `1HGCM82633A${vehicleId.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
      ],
    );

    const config = { getOrThrow: () => process.env.TEST_DATABASE_URL } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.$connect();
    const requestContext = { get: () => ({ companyId }) } as unknown as RequestContext;
    store = new ReminderDispatchStore(new PrismaUnitOfWork(prisma, requestContext));
  });

  afterAll(async () => {
    await client.query('DELETE FROM rental.reservation_reminder_dispatches WHERE company_id = $1', [
      companyId,
    ]);
    await client.query('DELETE FROM rental.reservations WHERE company_id = $1', [companyId]);
    await client.query('DELETE FROM rental.vehicles WHERE id = $1', [vehicleId]);
    await client.query('DELETE FROM rental.vehicle_categories WHERE id = $1', [categoryId]);
    await client.query('DELETE FROM rental.customers WHERE id = $1', [customerId]);
    await client.end();
    await prisma.$disconnect();
  });

  it('dos reclamos en paralelo del mismo recordatorio: uno solo gana', async () => {
    const reservationId = await newReservation();
    const now = new Date();

    const results = await Promise.all([
      store.claim(companyId, reservationId, now),
      store.claim(companyId, reservationId, now),
    ]);

    expect(results.filter((attempt) => attempt !== null)).toEqual([1]);
    expect(await dispatchOf(reservationId)).toMatchObject({ status: 'Sending', attempts: 1 });
  });

  it('cada fallo habilita un reintento hasta el tercero; despues no se reclama mas', async () => {
    const reservationId = await newReservation();
    const now = new Date();

    for (const expectedAttempt of [1, 2, 3]) {
      const attempt = await store.claim(companyId, reservationId, now);
      expect(attempt).toBe(expectedAttempt);
      await store.markFailed(companyId, reservationId, expectedAttempt, `fallo ${expectedAttempt}`);
    }

    expect(await store.claim(companyId, reservationId, now)).toBeNull();
    expect(await dispatchOf(reservationId)).toMatchObject({
      status: 'Failed',
      attempts: 3,
      last_error: 'fallo 3',
    });
  });

  it('un Sending reciente no se reclama; uno colgado (mas viejo que el limite) si', async () => {
    const reservationId = await newReservation();
    const start = new Date();

    expect(await store.claim(companyId, reservationId, start)).toBe(1);
    const recent = new Date(start.getTime() + REMINDER_STALE_SENDING_MS / 2);
    expect(await store.claim(companyId, reservationId, recent)).toBeNull();
    const stale = new Date(start.getTime() + REMINDER_STALE_SENDING_MS + 1000);
    expect(await store.claim(companyId, reservationId, stale)).toBe(2);
  });

  it('el resultado de un intento viejo no pisa el estado del siguiente', async () => {
    const reservationId = await newReservation();
    const start = new Date();
    expect(await store.claim(companyId, reservationId, start)).toBe(1);
    const stale = new Date(start.getTime() + REMINDER_STALE_SENDING_MS + 1000);
    expect(await store.claim(companyId, reservationId, stale)).toBe(2);

    // El worker lento del intento 1 termina tarde.
    await store.markSent(companyId, reservationId, 1);
    expect(await dispatchOf(reservationId)).toMatchObject({ status: 'Sending', attempts: 2 });

    await store.markSent(companyId, reservationId, 2);
    expect(await dispatchOf(reservationId)).toMatchObject({ status: 'Sent', attempts: 2 });
    expect(await store.claim(companyId, reservationId, stale)).toBeNull();
  });
});
