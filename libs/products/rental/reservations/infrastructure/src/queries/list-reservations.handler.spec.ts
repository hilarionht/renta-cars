import { encodeCursor, type ReadTransaction } from '@platform/persistence-kernel';
import { UnsupportedExpandError } from '@platform/shared-kernel';

import { ListReservationsHandler } from './list-reservations.handler';

// docs/persistence/10-DECISIONES.md #135.
describe('ListReservationsHandler', () => {
  const record = (id: string, customerId = 'c1', vehicleId = 'v1') => ({
    id,
    customerId,
    vehicleId,
    status: 'Confirmed',
    startDate: new Date('2026-10-20T13:00:00Z'),
    endDate: new Date('2026-10-22T13:00:00Z'),
    baseAmountMinorUnits: 10000,
    baseAmountCurrency: 'ARS',
    authorizedDrivers: [],
  });

  function build(records: unknown[]) {
    const reservationFindMany = jest.fn().mockResolvedValue(records);
    const customerFindMany = jest.fn().mockResolvedValue([{ id: 'c1', name: 'Ana' }]);
    const vehicleFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'v1', licensePlate: 'AB123CD', branchId: 'b1' }]);
    const tx = {
      reservation: { findMany: reservationFindMany },
      customer: { findMany: customerFindMany },
      vehicle: { findMany: vehicleFindMany },
    };
    const run = jest.fn((work: (tx: unknown) => Promise<unknown>) => work(tx));
    const handler = new ListReservationsHandler({ run } as unknown as ReadTransaction);
    return { handler, run, reservationFindMany, customerFindMany, vehicleFindMany };
  }

  it('pagina por cursor y pasa companyId a la transaccion', async () => {
    const { handler, run, reservationFindMany } = build([record('r3'), record('r2'), record('r1')]);

    const result = await handler.execute({ companyId: 'company-1', limit: 2 });

    expect((run.mock.calls[0] as unknown[])[1]).toBe('company-1');
    expect(reservationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: 'desc' }, take: 3 }),
    );
    expect(result.items.map((item) => item.id)).toEqual(['r3', 'r2']);
    expect(result.nextCursor).toBe(encodeCursor('r2'));
  });

  it('sin expand no lee clientes ni vehiculos', async () => {
    const { handler, customerFindMany, vehicleFindMany } = build([record('r1')]);

    const result = await handler.execute({ companyId: 'company-1' });

    expect(customerFindMany).not.toHaveBeenCalled();
    expect(vehicleFindMany).not.toHaveBeenCalled();
    expect(result.items[0]).not.toHaveProperty('customer');
  });

  it('con expand=customer,vehicle agrega los objetos minimos con una lectura por valor', async () => {
    const { handler, customerFindMany, vehicleFindMany } = build([record('r2'), record('r1')]);

    const result = await handler.execute({
      companyId: 'company-1',
      expand: ['customer', 'vehicle'],
    });

    expect(customerFindMany).toHaveBeenCalledTimes(1);
    expect(customerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['c1'] } } }),
    );
    expect(vehicleFindMany).toHaveBeenCalledTimes(1);
    expect(result.items[0].customer).toEqual({ id: 'c1', name: 'Ana' });
    expect(result.items[1].vehicle).toEqual({ id: 'v1', licensePlate: 'AB123CD', branchId: 'b1' });
  });

  it('rechaza un expand fuera del allow-list sin consultar la base', async () => {
    const { handler, run } = build([]);

    await expect(handler.execute({ companyId: 'company-1', expand: ['invoices'] })).rejects.toThrow(
      UnsupportedExpandError,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('con branchId filtra por la sucursal del vehiculo', async () => {
    const { handler, reservationFindMany } = build([]);

    await handler.execute({ companyId: 'company-1', branchId: 'b1' });

    expect(reservationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vehicle: { branchId: 'b1' } }) as unknown,
      }),
    );
  });
});
