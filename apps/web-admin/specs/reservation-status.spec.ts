import { ApiError, NonexistentLocalTimeError } from '@frontend/data-access-core';

import { apiErrorMessage } from '../src/lib/api-error-message';
import { availableActions, reservationStatusLabel } from '../src/lib/reservation-status';

// docs/persistence/10-DECISIONES.md #135: acciones por estado y permiso.
describe('availableActions', () => {
  const all = () => true;
  const now = new Date('2026-10-20T12:00:00Z');
  const future = '2026-10-25T13:00:00Z';
  const past = '2026-10-19T13:00:00Z';

  it('sigue la tabla de estados del dominio', () => {
    expect(availableActions({ status: 'Draft', startDate: future }, all, now)).toEqual([
      'confirm',
      'reschedule',
      'cancel',
    ]);
    expect(availableActions({ status: 'CheckedOut', startDate: past }, all, now)).toEqual([
      'check-in',
      'extend',
      'swap-vehicle',
    ]);
    for (const status of ['CheckedIn', 'Closed', 'Cancelled']) {
      expect(availableActions({ status, startDate: past }, all, now)).toEqual([]);
    }
  });

  it('no-show solo despues del inicio de la reserva', () => {
    expect(availableActions({ status: 'Confirmed', startDate: future }, all, now)).not.toContain(
      'mark-no-show',
    );
    expect(availableActions({ status: 'Confirmed', startDate: past }, all, now)).toContain(
      'mark-no-show',
    );
  });

  it('filtra por permiso; extender aparece con pedir o aprobar', () => {
    const only = (granted: string[]) => (permissions: readonly string[]) =>
      permissions.some((permission) => granted.includes(permission));

    expect(
      availableActions(
        { status: 'Confirmed', startDate: past },
        only(['reservations:check-out']),
        now,
      ),
    ).toEqual(['check-out']);
    expect(
      availableActions(
        { status: 'CheckedOut', startDate: past },
        only(['reservations:request-extension']),
        now,
      ),
    ).toEqual(['extend']);
  });

  it('etiqueta de estado, con el valor crudo si es desconocido', () => {
    expect(reservationStatusLabel('CheckedOut')).toBe('En alquiler');
    expect(reservationStatusLabel('Otro')).toBe('Otro');
  });
});

describe('apiErrorMessage', () => {
  it('traduce los codigos conocidos', () => {
    expect(apiErrorMessage(new ApiError(409, 'x', 'CONCURRENT_MODIFICATION'))).toContain(
      'Otra persona',
    );
  });

  it('sin codigo conocido usa el detalle del API', () => {
    expect(apiErrorMessage(new ApiError(422, 'Detalle del API', 'OTRO'))).toBe('Detalle del API');
  });

  it('hora inexistente por DST y errores de red', () => {
    expect(
      apiErrorMessage(new NonexistentLocalTimeError('2026-03-08T02:30', 'America/New_York')),
    ).toContain('no existe');
    expect(apiErrorMessage(new TypeError('Failed to fetch'))).toContain('conexión');
  });
});
