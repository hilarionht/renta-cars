import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ApiError, type ApiClient } from '@frontend/data-access-core';

import { useReservationAction } from './mutations';

const request = jest.fn();

jest.mock('../auth-context', () => ({
  useWebAuth: () => ({ api: { request } as unknown as ApiClient }),
}));

// docs/persistence/10-DECISIONES.md #135.
describe('useReservationAction', () => {
  let queryClient: QueryClient;
  let invalidateQueries: jest.SpyInstance;

  beforeEach(() => {
    request.mockReset();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('hace POST a la sub-ruta de la accion con su cuerpo', async () => {
    request.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReservationAction('r1'), { wrapper });

    const body = {
      newStartDate: '2026-11-01T13:00:00.000Z',
      newEndDate: '2026-11-03T13:00:00.000Z',
    };
    await act(() => result.current.mutateAsync({ action: 'reschedule', body }));

    expect(request).toHaveBeenCalledWith('/api/v1/reservations/r1/reschedule', {
      method: 'POST',
      body,
    });
  });

  it('las acciones sin cuerpo no mandan body', async () => {
    request.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReservationAction('r1'), { wrapper });

    await act(() => result.current.mutateAsync({ action: 'confirm' }));

    expect(request).toHaveBeenCalledWith('/api/v1/reservations/r1/confirm', {
      method: 'POST',
      body: undefined,
    });
  });

  it('ante un 409 CONCURRENT_MODIFICATION igual invalida reservas para recargar', async () => {
    request.mockRejectedValue(new ApiError(409, 'conflict', 'CONCURRENT_MODIFICATION'));
    const { result } = renderHook(() => useReservationAction('r1'), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ action: 'confirm' })).rejects.toBeInstanceOf(
        ApiError,
      );
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reservations'] });
  });
});
