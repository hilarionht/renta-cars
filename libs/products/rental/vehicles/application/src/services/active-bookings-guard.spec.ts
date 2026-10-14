import type { ActiveBooking, CalendarPort } from '@platform/calendar/application';
import { VehicleHasActiveBookingsError } from '@rental/vehicles/domain';

import { ActiveBookingsGuard } from './active-bookings-guard';

// docs/persistence/10-DECISIONES.md #137.
describe('ActiveBookingsGuard', () => {
  function build(bookings: ActiveBooking[]) {
    const calendarPort = {
      findActiveBookings: jest.fn().mockResolvedValue(bookings),
    } as unknown as CalendarPort;
    return { guard: new ActiveBookingsGuard(calendarPort), calendarPort };
  }

  const booking = (referenceId: string, start: string): ActiveBooking => ({
    referenceId,
    startDate: new Date(start),
    endDate: new Date(new Date(start).getTime() + 2 * 86_400_000),
  });

  it('pide las ocupaciones del vehiculo con el companyId explicito', async () => {
    const { guard, calendarPort } = build([]);

    await guard.assertNoneBlocked({ companyId: 'c1', vehicleId: 'v1', blockedUntil: null });

    expect(calendarPort.findActiveBookings).toHaveBeenCalledWith('c1', 'vehicle', 'v1');
  });

  it('con bloqueo hasta una fecha, solo choca la reserva que empieza antes', async () => {
    const { guard } = build([booking('r-antes', '2026-11-05'), booking('r-despues', '2026-12-01')]);

    await expect(
      guard.assertNoneBlocked({
        companyId: 'c1',
        vehicleId: 'v1',
        blockedUntil: new Date('2026-11-10'),
      }),
    ).rejects.toThrow(/r-antes/);
    await expect(
      guard.assertNoneBlocked({
        companyId: 'c1',
        vehicleId: 'v1',
        blockedUntil: new Date('2026-11-10'),
      }),
    ).rejects.not.toThrow(/r-despues/);
  });

  it('sin fin de bloqueo (fuera de servicio), cualquier reserva activa choca', async () => {
    const { guard } = build([booking('r-lejana', '2027-06-01')]);

    await expect(
      guard.assertNoneBlocked({ companyId: 'c1', vehicleId: 'v1', blockedUntil: null }),
    ).rejects.toThrow(VehicleHasActiveBookingsError);
  });

  it('sin reservas activas, no lanza', async () => {
    const { guard } = build([booking('r-despues', '2026-12-01')]);

    await expect(
      guard.assertNoneBlocked({
        companyId: 'c1',
        vehicleId: 'v1',
        blockedUntil: new Date('2026-11-10'),
      }),
    ).resolves.toBeUndefined();
  });
});
