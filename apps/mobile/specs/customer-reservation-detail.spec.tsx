import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import type * as DataAccess from '@frontend/data-access';
import { ApiError, useCancelMyReservation, useMyReservation } from '@frontend/data-access';

import MyReservationDetail from '../app/customer/reservations/[id]';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@frontend/data-access', () => {
  const actual = jest.requireActual<typeof DataAccess>('@frontend/data-access');
  return { ...actual, useMyReservation: jest.fn(), useCancelMyReservation: jest.fn() };
});

const baseReservation = {
  id: 'reservation-1',
  customerId: 'c1',
  vehicleId: 'v1',
  startDate: '2026-09-01T10:00:00.000Z',
  endDate: '2026-09-04T10:00:00.000Z',
  baseAmountMinorUnits: 150000,
  currency: 'MXN',
  authorizedDriverIds: [],
};

describe('MyReservationDetail', () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'reservation-1' });
    (useCancelMyReservation as jest.Mock).mockReturnValue({ mutateAsync });
  });

  it('muestra "Cancelar" para una reserva Draft', () => {
    (useMyReservation as jest.Mock).mockReturnValue({
      data: { ...baseReservation, status: 'Draft' },
      isLoading: false,
    });

    render(<MyReservationDetail />);

    expect(screen.getByTestId('my-reservation-cancel')).toBeTruthy();
    expect(screen.getByText(/Borrador/)).toBeTruthy();
  });

  it('muestra "Cancelar" para una reserva Confirmed', () => {
    (useMyReservation as jest.Mock).mockReturnValue({
      data: { ...baseReservation, status: 'Confirmed' },
      isLoading: false,
    });

    render(<MyReservationDetail />);

    expect(screen.getByTestId('my-reservation-cancel')).toBeTruthy();
  });

  it('NO muestra "Cancelar" para una reserva ya Cancelled (Reservation.cancel() la rechazaria)', () => {
    (useMyReservation as jest.Mock).mockReturnValue({
      data: { ...baseReservation, status: 'Cancelled' },
      isLoading: false,
    });

    render(<MyReservationDetail />);

    expect(screen.queryByTestId('my-reservation-cancel')).toBeNull();
  });

  it('NO muestra "Cancelar" para una reserva CheckedOut', () => {
    (useMyReservation as jest.Mock).mockReturnValue({
      data: { ...baseReservation, status: 'CheckedOut' },
      isLoading: false,
    });

    render(<MyReservationDetail />);

    expect(screen.queryByTestId('my-reservation-cancel')).toBeNull();
  });

  it('al cancelar con exito, navega de vuelta a "Mis reservas"', async () => {
    (useMyReservation as jest.Mock).mockReturnValue({
      data: { ...baseReservation, status: 'Confirmed' },
      isLoading: false,
    });
    mutateAsync.mockResolvedValue(undefined);

    render(<MyReservationDetail />);
    fireEvent.press(screen.getByTestId('my-reservation-cancel'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('reservation-1'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/customer'));
  });

  it('si cancelar falla con ApiError, muestra su mensaje sin navegar', async () => {
    (useMyReservation as jest.Mock).mockReturnValue({
      data: { ...baseReservation, status: 'Confirmed' },
      isLoading: false,
    });
    mutateAsync.mockRejectedValue(new ApiError(409, 'Transicion invalida'));

    render(<MyReservationDetail />);
    fireEvent.press(screen.getByTestId('my-reservation-cancel'));

    await waitFor(() => expect(screen.getByText('Transicion invalida')).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();
  });
});
