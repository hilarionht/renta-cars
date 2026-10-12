import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';

import { WebAuthProvider, useWebAuth } from './auth-context';
import { clearSessionIndicator, hasSessionIndicator, markSessionActive } from './session-indicator';

// docs/persistence/10-DECISIONES.md #134.
function jsonResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('WebAuthProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    clearSessionIndicator();
  });

  function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <WebAuthProvider baseUrl="http://api.test">{children}</WebAuthProvider>
        </QueryClientProvider>
      </StrictMode>
    );
  }

  const callsTo = (path: string): [string, RequestInit][] =>
    (fetchMock.mock.calls as [string, RequestInit][]).filter(([url]) => url.endsWith(path));

  it('sin cookie indicadora queda anonimo y no intenta refresh', async () => {
    const { result } = renderHook(() => useWebAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con cookie indicadora recupera la sesion con UN solo refresh, aun bajo StrictMode', async () => {
    markSessionActive();
    fetchMock.mockResolvedValue(jsonResponse(201, { data: { accessToken: 'token-1' } }));

    const { result } = renderHook(() => useWebAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(callsTo('/api/v1/auth/refresh')).toHaveLength(1);
    const init = callsTo('/api/v1/auth/refresh')[0][1];
    expect(init.credentials).toBe('include');
  });

  it('si el refresh inicial falla, queda anonimo y limpia la cookie indicadora', async () => {
    markSessionActive();
    fetchMock.mockResolvedValue(jsonResponse(401, { title: 'Unauthorized' }));

    const { result } = renderHook(() => useWebAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(hasSessionIndicator()).toBe(false);
  });

  it('login exitoso autentica y marca la sesion', async () => {
    const { result } = renderHook(() => useWebAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    fetchMock.mockResolvedValue(jsonResponse(201, { data: { accessToken: 'token-login' } }));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.login({ companyId: 'c', email: 'a@b.c', password: 'x' });
    });

    expect(outcome).toEqual({ mfaRequired: false });
    expect(result.current.status).toBe('authenticated');
    expect(hasSessionIndicator()).toBe(true);
    const init = callsTo('/api/v1/auth/login')[0][1];
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['X-Client-Platform']).toBeUndefined();
  });

  it('login con MFA devuelve el challenge sin autenticar, y verifyMfa completa la sesion', async () => {
    const { result } = renderHook(() => useWebAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { data: { mfaRequired: true, mfaChallengeId: 'challenge-1' } }),
    );

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.login({ companyId: 'c', email: 'a@b.c', password: 'x' });
    });
    expect(outcome).toEqual({ mfaRequired: true, mfaChallengeId: 'challenge-1' });
    expect(result.current.status).toBe('anonymous');

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: { accessToken: 'token-mfa' } }));
    await act(async () => {
      await result.current.verifyMfa({
        companyId: 'c',
        mfaChallengeId: 'challenge-1',
        code: '123456',
      });
    });
    expect(result.current.status).toBe('authenticated');
  });

  it('logout cierra la sesion aunque el API falle', async () => {
    markSessionActive();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: { accessToken: 'token-1' } }));
    const { result } = renderHook(() => useWebAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    fetchMock.mockResolvedValueOnce(jsonResponse(500, { title: 'boom' }));
    await act(async () => {
      await result.current.logout().catch(() => undefined);
    });

    expect(result.current.status).toBe('anonymous');
    expect(hasSessionIndicator()).toBe(false);
  });
});
