import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type * as DataAccess from '@frontend/data-access';
import { ApiError, useCreateMyReservation } from '@frontend/data-access';

import NewMyReservation from '../app/customer/reservations/new';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@frontend/data-access', () => {
  const actual = jest.requireActual<typeof DataAccess>('@frontend/data-access');
  return { ...actual, useCreateMyReservation: jest.fn() };
});

describe('NewMyReservation', () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateMyReservation as jest.Mock).mockReturnValue({ mutateAsync });
  });

  it('valida vehicleId/startDate/endDate antes de llamar a mutateAsync()', async () => {
    render(<NewMyReservation />);

    fireEvent.press(screen.getByTestId('new-reservation-submit'));

    await waitFor(() =>
      expect(screen.getByText('vehicleId debe ser un UUID valido.')).toBeTruthy(),
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('con datos validos, crea la reserva y navega al detalle con el id devuelto', async () => {
    mutateAsync.mockResolvedValue({ id: 'new-reservation-id' });
    render(<NewMyReservation />);

    fireEvent.changeText(
      screen.getByTestId('new-reservation-vehicle-id'),
      '22222222-2222-2222-2222-222222222222',
    );
    fireEvent.changeText(
      screen.getByTestId('new-reservation-start-date'),
      '2026-09-01T10:00:00.000Z',
    );
    fireEvent.changeText(
      screen.getByTestId('new-reservation-end-date'),
      '2026-09-04T10:00:00.000Z',
    );
    fireEvent.press(screen.getByTestId('new-reservation-submit'));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        vehicleId: '22222222-2222-2222-2222-222222222222',
        startDate: '2026-09-01T10:00:00.000Z',
        endDate: '2026-09-04T10:00:00.000Z',
      }),
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/customer/reservations/new-reservation-id'),
    );
  });

  it('si mutateAsync() falla con ApiError, muestra su mensaje sin navegar', async () => {
    mutateAsync.mockRejectedValue(new ApiError(404, 'No hay ninguna Rate vigente'));
    render(<NewMyReservation />);

    fireEvent.changeText(
      screen.getByTestId('new-reservation-vehicle-id'),
      '22222222-2222-2222-2222-222222222222',
    );
    fireEvent.changeText(
      screen.getByTestId('new-reservation-start-date'),
      '2026-09-01T10:00:00.000Z',
    );
    fireEvent.changeText(
      screen.getByTestId('new-reservation-end-date'),
      '2026-09-04T10:00:00.000Z',
    );
    fireEvent.press(screen.getByTestId('new-reservation-submit'));

    await waitFor(() => expect(screen.getByText('No hay ninguna Rate vigente')).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();
  });
});
