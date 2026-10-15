import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { ApiClient } from '@frontend/data-access-core';

import { customerActionPath } from './mutations';
import { useCustomerActiveReservations } from './queries';

const requestPage = jest.fn();

jest.mock('../auth-context', () => ({
  useWebAuth: () => ({ api: { requestPage } as unknown as ApiClient }),
}));

// docs/persistence/10-DECISIONES.md #139.
describe('customerActionPath', () => {
  it('arma la sub-ruta de cada accion', () => {
    expect(customerActionPath('c1', { action: 'block', body: { reason: 'x' } })).toBe(
      '/api/v1/customers/c1/block',
    );
    expect(customerActionPath('c1', { action: 'unblock' })).toBe('/api/v1/customers/c1/unblock');
    expect(customerActionPath('c1', { action: 'verify-document', documentId: 'd1' })).toBe(
      '/api/v1/customers/c1/identity-documents/d1/verify',
    );
    expect(customerActionPath('c1', { action: 'validate-license', driverId: 'a1' })).toBe(
      '/api/v1/customers/c1/additional-drivers/a1/validate-license',
    );
    expect(customerActionPath('c1', { action: 'revoke-driver', driverId: 'a1' })).toBe(
      '/api/v1/customers/c1/additional-drivers/a1/revoke',
    );
    expect(customerActionPath('c1', { action: 'additional-drivers', body: { name: 'Ana' } })).toBe(
      '/api/v1/customers/c1/additional-drivers',
    );
  });
});

describe('useCustomerActiveReservations', () => {
  function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('junta las Confirmed y las CheckedOut del cliente, ordenadas por retiro', async () => {
    requestPage.mockImplementation((_path: string, options: { query: { status: string } }) =>
      Promise.resolve({
        data:
          options.query.status === 'Confirmed'
            ? [{ id: 'r2', startDate: '2026-12-01T10:00:00.000Z' }]
            : [{ id: 'r1', startDate: '2026-11-01T10:00:00.000Z' }],
        meta: { nextCursor: null, limit: 100 },
      }),
    );

    const { result } = renderHook(() => useCustomerActiveReservations('c1'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((reservation) => reservation.id)).toEqual(['r1', 'r2']);
    const queries = requestPage.mock.calls.map(
      ([, options]: [string, { query: Record<string, unknown> }]) => options.query,
    );
    expect(queries).toContainEqual(
      expect.objectContaining({ customerId: 'c1', status: 'CheckedOut' }),
    );
  });
});
