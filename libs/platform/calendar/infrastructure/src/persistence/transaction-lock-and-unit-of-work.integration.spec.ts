import { randomUUID } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import { Client } from 'pg';

import {
  asPrismaTransaction,
  PrismaService,
  PrismaTransactionLock,
  PrismaUnitOfWork,
  type RequestContext,
} from '@platform/persistence-kernel';
import { ConcurrentModificationError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #141, contra Postgres real (Testcontainers):
// - el lock transaccional (pg_advisory_xact_lock[_shared]) con el PrismaClient y el driver
//   adapter reales: el codigo 55P03 (lock_timeout) tiene que llegar como
//   ConcurrentModificationError (409), algo que ningun unitario puede comprobar;
// - una ocupacion escrita dentro de la transaccion de la reserva se revierte si algo falla
//   antes de confirmar (antes eran dos transacciones y quedaba el slot huerfano).
describe('Lock transaccional y UnitOfWork (#141)', () => {
  let prisma: PrismaService;
  let unitOfWork: PrismaUnitOfWork;
  let lock: PrismaTransactionLock;
  let client: Client;
  const companyId = randomUUID();
  const resourceId = randomUUID();

  beforeAll(async () => {
    const config = {
      getOrThrow: () => process.env.TEST_DATABASE_URL,
    } as unknown as ConfigService;
    prisma = new PrismaService(config);
    await prisma.$connect();
    const requestContext = { get: () => ({ companyId }) } as unknown as RequestContext;
    unitOfWork = new PrismaUnitOfWork(prisma, requestContext);
    lock = new PrismaTransactionLock();
    client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.query(
      'DELETE FROM scheduling.availability_slots WHERE company_id = $1 AND resource_id = $2',
      [companyId, resourceId],
    );
    await client.end();
    await prisma.$disconnect();
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // El que toma el lock primero lo retiene hasta que `release` se resuelva.
  function holdLock(key: string, mode: 'shared' | 'exclusive') {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let acquired!: () => void;
    const isAcquired = new Promise<void>((resolve) => (acquired = resolve));
    const done = unitOfWork.run(async (tx) => {
      await lock.acquire(tx, key, mode);
      acquired();
      await released;
    });
    return { isAcquired, release, done };
  }

  it('un exclusivo frena a un compartido, que recibe ConcurrentModificationError al vencer lock_timeout', async () => {
    const key = `vehicle:${randomUUID()}`;
    const holder = holdLock(key, 'exclusive');
    await holder.isAcquired;

    const startedAt = Date.now();
    await expect(unitOfWork.run((tx) => lock.acquire(tx, key, 'shared'))).rejects.toBeInstanceOf(
      ConcurrentModificationError,
    );
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1500);

    holder.release();
    await holder.done;
  });

  it('dos compartidos no se frenan entre si', async () => {
    const key = `branch:${randomUUID()}`;
    const holder = holdLock(key, 'shared');
    await holder.isAcquired;

    await expect(unitOfWork.run((tx) => lock.acquire(tx, key, 'shared'))).resolves.toBeUndefined();

    holder.release();
    await holder.done;
  });

  it('el que espera entra apenas el otro confirma (el lock se libera con la transaccion)', async () => {
    const key = `vehicle:${randomUUID()}`;
    const holder = holdLock(key, 'exclusive');
    await holder.isAcquired;

    const waiter = unitOfWork.run((tx) => lock.acquire(tx, key, 'exclusive'));
    await sleep(300);
    holder.release();
    await holder.done;

    await expect(waiter).resolves.toBeUndefined();
  });

  it('una ocupacion escrita en la transaccion se revierte si algo falla antes del commit', async () => {
    const slotId = randomUUID();

    await expect(
      unitOfWork.run(async (tx) => {
        await asPrismaTransaction(tx).availabilitySlot.create({
          data: {
            id: slotId,
            companyId,
            resourceType: 'vehicle',
            resourceId,
            startDate: new Date('2027-01-01T10:00:00Z'),
            endDate: new Date('2027-01-03T10:00:00Z'),
            slotType: 'Booking',
            referenceId: randomUUID(),
            status: 'Active',
          },
        });
        // Simula que el guardado de la reserva falla (p. ej. version desactualizada).
        throw new Error('fallo al guardar la reserva');
      }),
    ).rejects.toThrow('fallo al guardar la reserva');

    const result = await client.query(
      'SELECT count(*)::int AS count FROM scheduling.availability_slots WHERE id = $1',
      [slotId],
    );
    expect(result.rows[0].count).toBe(0);
  });
});
