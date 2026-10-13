import type { ReadTransaction } from '@platform/persistence-kernel';
import { ReservationNotFoundError } from '@rental/reservations/domain';

import { GetReservationDetailHandler } from './get-reservation-detail.handler';

// docs/persistence/10-DECISIONES.md #135.
describe('GetReservationDetailHandler', () => {
  const record = {
    id: 'r1',
    customerId: 'c1',
    vehicleId: 'v1',
    status: 'CheckedIn',
    startDate: new Date('2026-10-20T13:00:00Z'),
    endDate: new Date('2026-10-22T13:00:00Z'),
    baseAmountMinorUnits: 10000,
    baseAmountCurrency: 'ARS',
    authorizedDrivers: [{ additionalDriverId: 'd1' }],
    inspections: [
      {
        id: 'i1',
        type: 'CheckOut',
        odometer: 1000,
        fuelLevel: 100,
        inspectedAt: new Date('2026-10-20T13:05:00Z'),
        inspectedBy: 'u1',
      },
    ],
    damageReports: [
      {
        id: 'dr1',
        inspectionId: 'i2',
        description: 'Raspon',
        severity: 'Minor',
        imputableToCustomer: true,
        createdAt: new Date('2026-10-22T13:10:00Z'),
      },
    ],
    priceAdjustments: [
      {
        id: 'pa1',
        kind: 'DamagePenalty',
        amountMinorUnits: 5000,
        currency: 'ARS',
        reason: null,
        createdAt: new Date('2026-10-22T13:10:00Z'),
      },
    ],
  };

  function build(found: unknown) {
    const findFirst = jest.fn().mockResolvedValue(found);
    const customerFindMany = jest.fn().mockResolvedValue([{ id: 'c1', name: 'Ana' }]);
    const tx = {
      reservation: { findFirst },
      customer: { findMany: customerFindMany },
      vehicle: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const run = jest.fn((work: (tx: unknown) => Promise<unknown>) => work(tx));
    const handler = new GetReservationDetailHandler({ run } as unknown as ReadTransaction);
    return { handler, run, customerFindMany };
  }

  it('devuelve inspecciones, danos y ajustes, con companyId en la transaccion', async () => {
    const { handler, run } = build(record);

    const detail = await handler.execute({ companyId: 'company-1', reservationId: 'r1' });

    expect((run.mock.calls[0] as unknown[])[1]).toBe('company-1');
    expect(detail.authorizedDriverIds).toEqual(['d1']);
    expect(detail.inspections).toEqual([
      {
        id: 'i1',
        type: 'CheckOut',
        odometer: 1000,
        fuelLevel: 100,
        inspectedAt: '2026-10-20T13:05:00.000Z',
        inspectedBy: 'u1',
      },
    ]);
    expect(detail.damageReports[0].severity).toBe('Minor');
    expect(detail.priceAdjustments[0]).toEqual(
      expect.objectContaining({ amountMinorUnits: 5000, reason: undefined }),
    );
    expect(detail).not.toHaveProperty('customer');
  });

  it('con expand=customer agrega el cliente', async () => {
    const { handler, customerFindMany } = build(record);

    const detail = await handler.execute({
      companyId: 'company-1',
      reservationId: 'r1',
      expand: ['customer'],
    });

    expect(customerFindMany).toHaveBeenCalledTimes(1);
    expect(detail.customer).toEqual({ id: 'c1', name: 'Ana' });
  });

  it('lanza ReservationNotFoundError si no existe (o es de otra company, por RLS)', async () => {
    const { handler } = build(null);

    await expect(handler.execute({ companyId: 'company-1', reservationId: 'r9' })).rejects.toThrow(
      ReservationNotFoundError,
    );
  });
});
