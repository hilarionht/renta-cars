import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ApiError, type ApiClient } from '@frontend/data-access-core';

import { userActionRequest } from './mutations';
import { useActorName } from './queries';

const request = jest.fn();

jest.mock('../auth-context', () => ({
  useWebAuth: () => ({ status: 'authenticated', api: { request } as unknown as ApiClient }),
}));

// docs/persistence/10-DECISIONES.md #140.
describe('userActionRequest', () => {
  it('arma ruta, metodo y cuerpo de cada accion', () => {
    expect(userActionRequest('u1', { action: 'update', body: { branchId: null } })).toEqual({
      path: '/api/v1/users/u1',
      method: 'PATCH',
      body: { branchId: null },
    });
    expect(userActionRequest('u1', { action: 'revoke-role', roleId: 'r1' })).toEqual({
      path: '/api/v1/users/u1/revoke-role',
      method: 'POST',
      body: { roleId: 'r1' },
    });
    expect(userActionRequest('u1', { action: 'reactivate' })).toEqual({
      path: '/api/v1/users/u1/reactivate',
      method: 'POST',
    });
    expect(
      userActionRequest('u1', { action: 'change-password', body: { newPassword: 'x' } }).path,
    ).toBe('/api/v1/users/u1/change-password');
  });
});

describe('useActorName', () => {
  function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => request.mockReset());

  it('devuelve el nombre del usuario', async () => {
    request.mockResolvedValue({ name: 'Ana' });
    const { result } = renderHook(() => useActorName('u1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBe('Ana'));
  });

  it('un usuario que ya no existe da null, no error', async () => {
    request.mockRejectedValue(new ApiError(404, 'no existe'));
    const { result } = renderHook(() => useActorName('u1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeNull());
  });

  it('"system" no consulta el API', () => {
    renderHook(() => useActorName('system'), { wrapper });
    expect(request).not.toHaveBeenCalled();
  });
});
