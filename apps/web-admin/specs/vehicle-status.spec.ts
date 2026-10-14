import {
  availableVehicleActions,
  blockingReservations,
  displayVehicleStatus,
  isDocumentExpired,
} from '../src/lib/vehicle-status';

// docs/persistence/10-DECISIONES.md #137.
describe('displayVehicleStatus', () => {
  const reservation = (status: string) => ({
    id: 'r1',
    status,
    startDate: '2026-10-20T13:00:00Z',
    endDate: '2026-10-22T13:00:00Z',
  });

  it('un Available con reserva CheckedOut se muestra En alquiler', () => {
    expect(
      displayVehicleStatus({ status: 'Available', activeReservation: reservation('CheckedOut') }),
    ).toEqual(expect.objectContaining({ key: 'CheckedOut', label: 'En alquiler' }));
  });

  it('con una reserva solo Confirmed sigue Disponible', () => {
    expect(
      displayVehicleStatus({ status: 'Available', activeReservation: reservation('Confirmed') })
        .label,
    ).toBe('Disponible');
  });

  it('respeta el estado propio del vehiculo (mantenimiento, fuera de servicio)', () => {
    expect(displayVehicleStatus({ status: 'Maintenance' }).label).toBe('En mantenimiento');
    expect(displayVehicleStatus({ status: 'OutOfService' }).tone).toBe('danger');
  });
});

describe('availableVehicleActions', () => {
  it('sigue la maquina de estados del vehiculo', () => {
    expect(availableVehicleActions('Registered', true)).toEqual(['enable']);
    expect(availableVehicleActions('Available', true)).toEqual([
      'schedule-maintenance',
      'report-damage',
      'mark-out-of-service',
    ]);
    expect(availableVehicleActions('OutOfService', true)).toEqual(['schedule-maintenance']);
    expect(availableVehicleActions('Maintenance', true)).toEqual([]);
  });

  it('sin vehicles:manage no hay acciones', () => {
    expect(availableVehicleActions('Available', false)).toEqual([]);
  });
});

it('isDocumentExpired compara con la fecha actual', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  expect(isDocumentExpired({ expiryDate: '2026-10-19T23:59:00Z' }, now)).toBe(true);
  expect(isDocumentExpired({ expiryDate: '2027-01-01T00:00:00Z' }, now)).toBe(false);
});

describe('blockingReservations', () => {
  const reservation = (id: string, startDate: string) => ({
    id,
    status: 'Confirmed',
    startDate,
    endDate: '2027-01-01T00:00:00Z',
    overdue: false,
  });
  const list = [
    reservation('antes', '2026-11-05T13:00:00Z'),
    reservation('despues', '2026-12-01T13:00:00Z'),
  ];

  it('con fin de bloqueo, solo las que empiezan antes', () => {
    expect(blockingReservations(list, new Date('2026-11-10T00:00:00Z')).map((r) => r.id)).toEqual([
      'antes',
    ]);
  });

  it('sin fin (fuera de servicio), todas', () => {
    expect(blockingReservations(list, null)).toHaveLength(2);
  });
});
