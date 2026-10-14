import {
  loadActiveReservations,
  pickCurrentReservation,
  withOverdueFlag,
} from './vehicle-reservations.read';

// docs/persistence/10-DECISIONES.md #137.
describe('vehicle-reservations.read', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const ref = (id: string, status: string, start: string, end: string) => ({
    id,
    status,
    startDate: start,
    endDate: end,
  });

  describe('loadActiveReservations', () => {
    it('lee Confirmed/CheckedOut sin borrar, en una sola consulta, agrupadas por vehiculo', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'r1',
          vehicleId: 'v1',
          status: 'Confirmed',
          startDate: new Date('2026-10-25T13:00:00Z'),
          endDate: new Date('2026-10-27T13:00:00Z'),
        },
        {
          id: 'r2',
          vehicleId: 'v2',
          status: 'CheckedOut',
          startDate: new Date('2026-10-18T13:00:00Z'),
          endDate: new Date('2026-10-21T13:00:00Z'),
        },
      ]);

      const result = await loadActiveReservations({ reservation: { findMany } } as never, [
        'v1',
        'v2',
      ]);

      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            vehicleId: { in: ['v1', 'v2'] },
            status: { in: ['Confirmed', 'CheckedOut'] },
            deletedAt: null,
          },
        }),
      );
      expect(result.get('v1')?.[0]).toEqual(
        ref('r1', 'Confirmed', '2026-10-25T13:00:00.000Z', '2026-10-27T13:00:00.000Z'),
      );
      expect(result.get('v2')?.[0].status).toBe('CheckedOut');
    });

    it('sin vehiculos no consulta', async () => {
      const findMany = jest.fn();
      await loadActiveReservations({ reservation: { findMany } } as never, []);
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('pickCurrentReservation', () => {
    it('prioriza la CheckedOut aunque haya una Confirmed antes', () => {
      const picked = pickCurrentReservation(
        [
          ref('c', 'Confirmed', '2026-10-21T00:00:00Z', '2026-10-22T00:00:00Z'),
          ref('o', 'CheckedOut', '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z'),
        ],
        now,
      );
      expect(picked?.id).toBe('o');
    });

    it('si no hay CheckedOut, la proxima Confirmed que todavia no termino', () => {
      const picked = pickCurrentReservation(
        [
          ref('vencida', 'Confirmed', '2026-10-10T00:00:00Z', '2026-10-12T00:00:00Z'),
          ref('proxima', 'Confirmed', '2026-10-25T00:00:00Z', '2026-10-27T00:00:00Z'),
        ],
        now,
      );
      expect(picked?.id).toBe('proxima');
    });

    it('sin reservas devuelve undefined', () => {
      expect(pickCurrentReservation(undefined, now)).toBeUndefined();
    });
  });

  it('withOverdueFlag marca las que ya debieron terminar y conserva todas', () => {
    const result = withOverdueFlag(
      [
        ref('atrasada', 'CheckedOut', '2026-10-15T00:00:00Z', '2026-10-18T00:00:00Z'),
        ref('futura', 'Confirmed', '2026-10-25T00:00:00Z', '2026-10-27T00:00:00Z'),
      ],
      now,
    );
    expect(result.map((r) => [r.id, r.overdue])).toEqual([
      ['atrasada', true],
      ['futura', false],
    ]);
  });
});
