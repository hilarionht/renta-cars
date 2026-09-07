import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  useAuth,
  useReservationsToCheckIn,
  useReservationsToCheckOut,
} from '@frontend/data-access';

import Index from '../app/index';

// Vive fuera de app/ para que Expo Router no lo trate como una ruta (docs/06-CONVENCIONES-
// FRONTEND.md SS4) - mismo patron que apps/web-admin/specs/. Fase 5 (docs/persistence/
// 10-DECISIONES.md #108): Index ahora usa hooks reales (useAuth/useReservationsTo*), necesita
// QueryClientProvider + mocks de data-access, ya no renderiza sola.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@frontend/data-access', () => ({
  useAuth: jest.fn(),
  useReservationsToCheckOut: jest.fn(),
  useReservationsToCheckIn: jest.fn(),
}));

function renderIndex() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <Index />
    </QueryClientProvider>,
  );
}

describe('Index (home)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ logout: jest.fn() });
  });

  it('muestra el heading Renta', () => {
    (useReservationsToCheckOut as jest.Mock).mockReturnValue({ data: [], isLoading: false });
    (useReservationsToCheckIn as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    renderIndex();

    expect(screen.getByTestId('heading')).toHaveTextContent(/Renta/);
  });

  it('mientras carga, no muestra el mensaje de lista vacia', () => {
    (useReservationsToCheckOut as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });
    (useReservationsToCheckIn as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });

    renderIndex();

    expect(screen.queryByText('No hay reservas para retirar.')).toBeNull();
    expect(screen.queryByText('No hay reservas para devolver.')).toBeNull();
  });

  it('muestra el mensaje vacio cuando no hay reservas', () => {
    (useReservationsToCheckOut as jest.Mock).mockReturnValue({ data: [], isLoading: false });
    (useReservationsToCheckIn as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    renderIndex();

    expect(screen.getByText('No hay reservas para retirar.')).toBeTruthy();
    expect(screen.getByText('No hay reservas para devolver.')).toBeTruthy();
  });

  it('tap en una reserva de "para retirar" navega a check-out', async () => {
    (useReservationsToCheckOut as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'reservation-1',
          customerId: 'c1',
          vehicleId: 'v1',
          status: 'Confirmed',
          startDate: '2026-01-01T00:00:00Z',
          endDate: '2026-01-05T00:00:00Z',
          baseAmountMinorUnits: 10000,
          currency: 'ARS',
          authorizedDriverIds: [],
        },
      ],
      isLoading: false,
    });
    (useReservationsToCheckIn as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    renderIndex();
    fireEvent.press(screen.getByTestId('reservation-reservation-1'));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/reservations/reservation-1/check-out'),
    );
  });

  it('tap en una reserva de "para devolver" navega a check-in', async () => {
    (useReservationsToCheckOut as jest.Mock).mockReturnValue({ data: [], isLoading: false });
    (useReservationsToCheckIn as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'reservation-2',
          customerId: 'c1',
          vehicleId: 'v1',
          status: 'CheckedOut',
          startDate: '2026-01-01T00:00:00Z',
          endDate: '2026-01-05T00:00:00Z',
          baseAmountMinorUnits: 10000,
          currency: 'ARS',
          authorizedDriverIds: [],
        },
      ],
      isLoading: false,
    });

    renderIndex();
    fireEvent.press(screen.getByTestId('reservation-reservation-2'));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/reservations/reservation-2/check-in'),
    );
  });
});
