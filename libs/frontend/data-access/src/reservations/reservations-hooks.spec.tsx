import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { apiRequest } from '../auth/api-client';
import {
  useCheckInReservation,
  useCheckOutReservation,
  useReservationsToCheckIn,
  useReservationsToCheckOut,
} from './reservations-hooks';

jest.mock('../auth/api-client', () => ({ apiRequest: jest.fn() }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('reservations hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useReservationsToCheckOut pide GET /reservations?status=Confirmed', async () => {
    (apiRequest as jest.Mock).mockResolvedValue([{ id: 'r1' }]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useReservationsToCheckOut(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/reservations?status=Confirmed');
    expect(result.current.data).toEqual([{ id: 'r1' }]);
  });

  it('useReservationsToCheckIn pide GET /reservations?status=CheckedOut', async () => {
    (apiRequest as jest.Mock).mockResolvedValue([{ id: 'r2' }]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useReservationsToCheckIn(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/reservations?status=CheckedOut');
  });

  it('useCheckOutReservation llama POST /reservations/:id/check-out e invalida ambas listas', async () => {
    (apiRequest as jest.Mock).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCheckOutReservation(), { wrapper });
    result.current.mutate({
      reservationId: 'r1',
      body: { odometer: 100, fuelLevelPercentage: 80, photoFileIds: [], inspectedBy: 'u1' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/reservations/r1/check-out', {
      method: 'POST',
      body: { odometer: 100, fuelLevelPercentage: 80, photoFileIds: [], inspectedBy: 'u1' },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reservations', 'to-check-out'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reservations', 'to-check-in'] });
  });

  it('useCheckInReservation llama POST /reservations/:id/check-in e invalida la lista de check-in', async () => {
    (apiRequest as jest.Mock).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCheckInReservation(), { wrapper });
    result.current.mutate({
      reservationId: 'r2',
      body: { odometer: 200, fuelLevelPercentage: 50, photoFileIds: [], inspectedBy: 'u1' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/reservations/r2/check-in', {
      method: 'POST',
      body: { odometer: 200, fuelLevelPercentage: 50, photoFileIds: [], inspectedBy: 'u1' },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reservations', 'to-check-in'] });
  });
});
