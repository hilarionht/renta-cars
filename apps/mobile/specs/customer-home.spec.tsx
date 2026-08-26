import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useCustomerAuth, useMyReservations } from '@frontend/data-access';

import CustomerHome from '../app/customer/index';

// Espejo de index.spec.tsx (motivo de vivir fuera de app/).
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@frontend/data-access', () => ({
  useCustomerAuth: jest.fn(),
  useMyReservations: jest.fn(),
}));

function renderCustomerHome() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CustomerHome />
    </QueryClientProvider>,
  );
}

describe('CustomerHome ("Mis reservas")', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCustomerAuth as jest.Mock).mockReturnValue({ logout: jest.fn() });
  });

  it('muestra el heading "Mis reservas"', () => {
    (useMyReservations as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    renderCustomerHome();

    expect(screen.getByTestId('heading')).toHaveTextContent(/Mis reservas/);
  });

  it('muestra el mensaje vacio cuando no hay reservas', () => {
    (useMyReservations as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    renderCustomerHome();

    expect(screen.getByText('Todavía no tenés reservas.')).toBeTruthy();
  });

  it('tap en una reserva navega al detalle', async () => {
    (useMyReservations as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'reservation-1',
          customerId: 'c1',
          vehicleId: 'v1',
          status: 'Draft',
          startDate: '2026-01-01T00:00:00Z',
          endDate: '2026-01-05T00:00:00Z',
          baseAmountMinorUnits: 10000,
          currency: 'MXN',
          authorizedDriverIds: [],
        },
      ],
      isLoading: false,
    });

    renderCustomerHome();
    fireEvent.press(screen.getByTestId('my-reservation-reservation-1'));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/customer/reservations/reservation-1'),
    );
  });

  it('boton "Nueva reserva" navega al form de creacion', () => {
    (useMyReservations as jest.Mock).mockReturnValue({ data: [], isLoading: false });

    renderCustomerHome();
    fireEvent.press(screen.getByTestId('customer-new-reservation'));

    expect(router.push).toHaveBeenCalledWith('/customer/reservations/new');
  });
});
