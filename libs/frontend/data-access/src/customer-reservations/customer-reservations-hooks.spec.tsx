import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { customerApiRequest } from '../customer-auth/customer-api-client';
import {
  useCancelMyReservation,
  useCreateMyReservation,
  useMyReservation,
  useMyReservations,
} from './customer-reservations-hooks';

jest.mock('../customer-auth/customer-api-client', () => ({ customerApiRequest: jest.fn() }));

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

describe('customer reservations hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useMyReservations pide GET /me/reservations', async () => {
    (customerApiRequest as jest.Mock).mockResolvedValue([{ id: 'r1' }]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyReservations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(customerApiRequest).toHaveBeenCalledWith('/api/v1/me/reservations');
    expect(result.current.data).toEqual([{ id: 'r1' }]);
  });

  it('useMyReservation pide GET /me/reservations/:id', async () => {
    (customerApiRequest as jest.Mock).mockResolvedValue({ id: 'r1', status: 'Draft' });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMyReservation('r1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(customerApiRequest).toHaveBeenCalledWith('/api/v1/me/reservations/r1');
  });

  it('useCreateMyReservation llama POST /me/reservations, devuelve {id} e invalida la lista', async () => {
    (customerApiRequest as jest.Mock).mockResolvedValue({ id: 'new-id' });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateMyReservation(), { wrapper });
    result.current.mutate({
      vehicleId: 'v1',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-02T00:00:00.000Z',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(customerApiRequest).toHaveBeenCalledWith('/api/v1/me/reservations', {
      method: 'POST',
      body: {
        vehicleId: 'v1',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-02T00:00:00.000Z',
      },
    });
    expect(result.current.data).toEqual({ id: 'new-id' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me-reservations', 'list'] });
  });

  it('useCancelMyReservation llama POST /me/reservations/:id/cancel e invalida lista + detalle', async () => {
    (customerApiRequest as jest.Mock).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelMyReservation(), { wrapper });
    result.current.mutate('r1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(customerApiRequest).toHaveBeenCalledWith('/api/v1/me/reservations/r1/cancel', {
      method: 'POST',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me-reservations', 'list'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['me-reservations', 'detail', 'r1'],
    });
  });
});
