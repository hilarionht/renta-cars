import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import type * as DataAccess from '@frontend/data-access';
import { ApiError, useAuth, useCheckInReservation, useUploadPhoto } from '@frontend/data-access';

import CheckIn from '../app/reservations/[id]/check-in';

// Vive fuera de app/ - mismo motivo que specs/login.spec.tsx.
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@frontend/data-access', () => {
  const actual = jest.requireActual<typeof DataAccess>('@frontend/data-access');
  return {
    ...actual,
    useAuth: jest.fn(),
    useCheckInReservation: jest.fn(),
    useUploadPhoto: jest.fn(),
  };
});

function renderCheckIn() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckIn />
    </QueryClientProvider>,
  );
}

describe('CheckIn', () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'reservation-2' });
    (useAuth as jest.Mock).mockReturnValue({ user: { sub: 'user-1' } });
    (useCheckInReservation as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
    (useUploadPhoto as jest.Mock).mockReturnValue({ mutateAsync: jest.fn() });
  });

  it('sin danos agregados, envia damages: undefined', async () => {
    mutateAsync.mockResolvedValue(undefined);
    renderCheckIn();

    fireEvent.changeText(screen.getByTestId('check-in-odometer'), '15500');
    fireEvent.changeText(screen.getByTestId('check-in-fuel'), '60');
    fireEvent.press(screen.getByTestId('check-in-submit'));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        reservationId: 'reservation-2',
        body: {
          odometer: 15500,
          fuelLevelPercentage: 60,
          photoFileIds: [],
          inspectedBy: 'user-1',
          damages: undefined,
        },
      }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('agregar un dano lo incluye en el submit con sus valores por defecto', async () => {
    mutateAsync.mockResolvedValue(undefined);
    renderCheckIn();

    fireEvent.press(screen.getByTestId('damage-add'));
    fireEvent.changeText(screen.getByTestId('damage-0-description'), 'Rayón en la puerta');
    fireEvent.press(screen.getByTestId('damage-0-severity-severe'));
    fireEvent.press(screen.getByTestId('damage-0-imputable'));

    fireEvent.changeText(screen.getByTestId('check-in-odometer'), '15500');
    fireEvent.changeText(screen.getByTestId('check-in-fuel'), '60');
    fireEvent.press(screen.getByTestId('check-in-submit'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const call = mutateAsync.mock.calls[0] as [
      {
        body: {
          damages: Array<{
            description: string;
            severity: string;
            imputableToCustomer: boolean;
            photoFileIds: string[];
          }>;
        };
      },
    ];
    expect(call[0].body.damages).toEqual([
      {
        description: 'Rayón en la puerta',
        severity: 'Severe',
        imputableToCustomer: true,
        photoFileIds: [],
      },
    ]);
  });

  it('quitar un dano lo saca del formulario', () => {
    renderCheckIn();

    fireEvent.press(screen.getByTestId('damage-add'));
    expect(screen.getByTestId('damage-0')).toBeTruthy();

    fireEvent.press(screen.getByTestId('damage-0-remove'));

    expect(screen.queryByTestId('damage-0')).toBeNull();
  });

  it('si la mutation falla con ApiError, muestra su mensaje sin navegar', async () => {
    mutateAsync.mockRejectedValue(new ApiError(409, 'La reserva no esta en estado CheckedOut'));
    renderCheckIn();

    fireEvent.changeText(screen.getByTestId('check-in-odometer'), '15500');
    fireEvent.changeText(screen.getByTestId('check-in-fuel'), '60');
    fireEvent.press(screen.getByTestId('check-in-submit'));

    await waitFor(() =>
      expect(screen.getByText('La reserva no esta en estado CheckedOut')).toBeTruthy(),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});
