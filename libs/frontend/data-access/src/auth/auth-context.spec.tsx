import { render, screen, waitFor } from '@testing-library/react';

import { AuthProvider, useAuth } from './auth-context';
import { apiRequest } from './api-client';
import { getStoredTokens, setStoredTokens, clearStoredTokens } from './secure-token-storage';

// Factories explicitas - mismo motivo que api-client.spec.ts: automock sin factory igual
// carga el modulo real (expo-secure-store, ESM sin transformar bajo este jest.config.ts).
jest.mock('./api-client', () => ({ apiRequest: jest.fn() }));
jest.mock('./secure-token-storage', () => ({
  getStoredTokens: jest.fn(),
  setStoredTokens: jest.fn(),
  clearStoredTokens: jest.fn(),
}));

function buildFakeAccessToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

function TestConsumer() {
  const { isLoading, isAuthenticated, user, login, logout } = useAuth();
  if (isLoading) {
    return <div>loading</div>;
  }
  return (
    <div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="user-sub">{user?.sub ?? 'none'}</div>
      <button onClick={() => void login({ companyId: 'c1', email: 'a@a.com', password: 'p' })}>
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider/useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getStoredTokens as jest.Mock).mockResolvedValue(null);
  });

  it('arranca sin sesion cuando SecureStore no tiene tokens guardados', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
  });

  it('restaura la sesion si ya hay tokens guardados al montar (app reabierta)', async () => {
    const accessToken = buildFakeAccessToken({ sub: 'user-1', companyId: 'c1', roles: [] });
    (getStoredTokens as jest.Mock).mockResolvedValue({ accessToken, refreshToken: 'r1' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));
    expect(screen.getByTestId('user-sub').textContent).toBe('user-1');
  });

  it('login() guarda los tokens nuevos y actualiza el usuario', async () => {
    const accessToken = buildFakeAccessToken({ sub: 'user-2', companyId: 'c1', roles: [] });
    (apiRequest as jest.Mock).mockResolvedValue({ accessToken, refreshToken: 'r2' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));

    screen.getByText('login').click();

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        expect.objectContaining({ method: 'POST', requiresAuth: false }),
      ),
    );
    await waitFor(() =>
      expect(setStoredTokens).toHaveBeenCalledWith({ accessToken, refreshToken: 'r2' }),
    );
    await waitFor(() => expect(screen.getByTestId('user-sub').textContent).toBe('user-2'));
  });

  it('logout() revoca la sesion server-side y limpia los tokens locales', async () => {
    const accessToken = buildFakeAccessToken({ sub: 'user-3', companyId: 'c1', roles: [] });
    (getStoredTokens as jest.Mock).mockResolvedValue({ accessToken, refreshToken: 'r3' });
    (apiRequest as jest.Mock).mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    screen.getByText('logout').click();

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/api/v1/auth/logout',
        expect.objectContaining({ method: 'POST', body: { refreshToken: 'r3' } }),
      ),
    );
    await waitFor(() => expect(clearStoredTokens).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
  });

  it('logout() limpia la sesion local aunque la llamada al backend falle', async () => {
    const accessToken = buildFakeAccessToken({ sub: 'user-4', companyId: 'c1', roles: [] });
    (getStoredTokens as jest.Mock).mockResolvedValue({ accessToken, refreshToken: 'r4' });
    (apiRequest as jest.Mock).mockRejectedValue(new Error('sin red'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    screen.getByText('logout').click();

    await waitFor(() => expect(clearStoredTokens).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
  });

  it('useAuth() fuera de AuthProvider tira un error explicito', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth() debe usarse dentro de <AuthProvider>',
    );
    consoleError.mockRestore();
  });
});
