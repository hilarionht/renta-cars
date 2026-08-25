import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import type * as DataAccess from '@frontend/data-access';
import { ApiError, useAuth, useCheckOutReservation, useUploadPhoto } from '@frontend/data-access';

import CheckOut from '../app/reservations/[id]/check-out';

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
    useCheckOutReservation: jest.fn(),
    useUploadPhoto: jest.fn(),
  };
});

function renderCheckOut() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckOut />
    </QueryClientProvider>,
  );
}

describe('CheckOut', () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'reservation-1' });
    (useAuth as jest.Mock).mockReturnValue({ user: { sub: 'user-1' } });
    (useCheckOutReservation as jest.Mock).mockReturnValue({ mutateAsync, isPending: false });
    (useUploadPhoto as jest.Mock).mockReturnValue({ mutateAsync: jest.fn() });
  });

  it('valida odometro/combustible antes de enviar', async () => {
    renderCheckOut();

    fireEvent.changeText(screen.getByTestId('check-out-odometer'), '-5');
    fireEvent.press(screen.getByTestId('check-out-submit'));

    await waitFor(() =>
      expect(screen.getByText('El odómetro no puede ser negativo.')).toBeTruthy(),
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('con datos validos, llama a la mutation con inspectedBy = user.sub y navega a home', async () => {
    mutateAsync.mockResolvedValue(undefined);
    renderCheckOut();

    fireEvent.changeText(screen.getByTestId('check-out-odometer'), '15000');
    fireEvent.changeText(screen.getByTestId('check-out-fuel'), '80');
    fireEvent.press(screen.getByTestId('check-out-submit'));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        reservationId: 'reservation-1',
        body: {
          odometer: 15000,
          fuelLevelPercentage: 80,
          photoFileIds: [],
          inspectedBy: 'user-1',
        },
      }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('si la mutation falla con ApiError, muestra su mensaje sin navegar', async () => {
    mutateAsync.mockRejectedValue(new ApiError(409, 'La reserva no esta en estado Confirmed'));
    renderCheckOut();

    fireEvent.changeText(screen.getByTestId('check-out-odometer'), '15000');
    fireEvent.changeText(screen.getByTestId('check-out-fuel'), '80');
    fireEvent.press(screen.getByTestId('check-out-submit'));

    await waitFor(() =>
      expect(screen.getByText('La reserva no esta en estado Confirmed')).toBeTruthy(),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('subir una foto la agrega a photoFileIds al confirmar', async () => {
    const uploadPhoto = jest.fn().mockResolvedValue('file-1');
    (useUploadPhoto as jest.Mock).mockReturnValue({ mutateAsync: uploadPhoto });
    mutateAsync.mockResolvedValue(undefined);
    const imagePicker = jest.requireMock<{
      requestMediaLibraryPermissionsAsync: jest.Mock;
      launchImageLibraryAsync: jest.Mock;
    }>('expo-image-picker');
    imagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'local-uri-1' }],
    });

    renderCheckOut();
    fireEvent.press(screen.getByText('+ Agregar foto'));
    await waitFor(() => expect(uploadPhoto).toHaveBeenCalledWith('local-uri-1'));

    fireEvent.changeText(screen.getByTestId('check-out-odometer'), '15000');
    fireEvent.changeText(screen.getByTestId('check-out-fuel'), '80');
    fireEvent.press(screen.getByTestId('check-out-submit'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const call = mutateAsync.mock.calls[0] as [{ body: { photoFileIds: string[] } }];
    expect(call[0].body.photoFileIds).toEqual(['file-1']);
  });
});
