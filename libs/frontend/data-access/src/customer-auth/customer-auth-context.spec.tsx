import { render, screen, waitFor } from '@testing-library/react';

import { CustomerAuthProvider, useCustomerAuth } from './customer-auth-context';
import { customerApiRequest } from './customer-api-client';
import {
  getStoredCustomerTokens,
  setStoredCustomerTokens,
  clearStoredCustomerTokens,
} from './customer-secure-token-storage';

// Factories explicitas - mismo motivo que auth/auth-context.spec.tsx.
jest.mock('./customer-api-client', () => ({ customerApiRequest: jest.fn() }));
jest.mock('./customer-secure-token-storage', () => ({
  getStoredCustomerTokens: jest.fn(),
  setStoredCustomerTokens: jest.fn(),
  clearStoredCustomerTokens: jest.fn(),
}));

function buildFakeAccessToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

function TestConsumer() {
  const { isLoading, isAuthenticated, customer, requestOtp, verifyOtp, logout } = useCustomerAuth();
  if (isLoading) {
    return <div>loading</div>;
  }
  return (
    <div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="customer-sub">{customer?.sub ?? 'none'}</div>
      <button onClick={() => void requestOtp({ companyId: 'c1', phone: '+525500000000' })}>
        request-otp
      </button>
      <button
        onClick={() => void verifyOtp({ companyId: 'c1', phone: '+525500000000', code: '123456' })}
      >
        verify-otp
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe('CustomerAuthProvider/useCustomerAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getStoredCustomerTokens as jest.Mock).mockResolvedValue(null);
  });

  it('arranca sin sesion cuando SecureStore no tiene tokens de cliente guardados', async () => {
    render(
      <CustomerAuthProvider>
        <TestConsumer />
      </CustomerAuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
  });

  it('restaura la sesion de cliente si ya hay tokens guardados al montar (app reabierta)', async () => {
    const accessToken = buildFakeAccessToken({
      sub: 'customer-1',
      companyId: 'c1',
      roles: [],
      actorType: 'Customer',
    });
    (getStoredCustomerTokens as jest.Mock).mockResolvedValue({ accessToken, refreshToken: 'r1' });

    render(
      <CustomerAuthProvider>
        <TestConsumer />
      </CustomerAuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));
    expect(screen.getByTestId('customer-sub').textContent).toBe('customer-1');
  });

  it('requestOtp() llama al endpoint de request sin cambiar el estado de sesion', async () => {
    (customerApiRequest as jest.Mock).mockResolvedValue(undefined);

    render(
      <CustomerAuthProvider>
        <TestConsumer />
      </CustomerAuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));

    screen.getByText('request-otp').click();

    await waitFor(() =>
      expect(customerApiRequest).toHaveBeenCalledWith(
        '/api/v1/customers/auth/otp/request',
        expect.objectContaining({ method: 'POST', requiresAuth: false }),
      ),
    );
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('verifyOtp() guarda los tokens nuevos y actualiza el customer', async () => {
    const accessToken = buildFakeAccessToken({
      sub: 'customer-2',
      companyId: 'c1',
      roles: [],
      actorType: 'Customer',
    });
    (customerApiRequest as jest.Mock).mockResolvedValue({ accessToken, refreshToken: 'r2' });

    render(
      <CustomerAuthProvider>
        <TestConsumer />
      </CustomerAuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));

    screen.getByText('verify-otp').click();

    await waitFor(() =>
      expect(customerApiRequest).toHaveBeenCalledWith(
        '/api/v1/customers/auth/otp/verify',
        expect.objectContaining({ method: 'POST', requiresAuth: false }),
      ),
    );
    await waitFor(() =>
      expect(setStoredCustomerTokens).toHaveBeenCalledWith({ accessToken, refreshToken: 'r2' }),
    );
    await waitFor(() => expect(screen.getByTestId('customer-sub').textContent).toBe('customer-2'));
  });

  it('logout() revoca la sesion server-side y limpia los tokens locales de cliente', async () => {
    const accessToken = buildFakeAccessToken({
      sub: 'customer-3',
      companyId: 'c1',
      roles: [],
      actorType: 'Customer',
    });
    (getStoredCustomerTokens as jest.Mock).mockResolvedValue({ accessToken, refreshToken: 'r3' });
    (customerApiRequest as jest.Mock).mockResolvedValue(undefined);

    render(
      <CustomerAuthProvider>
        <TestConsumer />
      </CustomerAuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    screen.getByText('logout').click();

    await waitFor(() =>
      expect(customerApiRequest).toHaveBeenCalledWith(
        '/api/v1/customers/auth/logout',
        expect.objectContaining({ method: 'POST', body: { refreshToken: 'r3' } }),
      ),
    );
    await waitFor(() => expect(clearStoredCustomerTokens).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
  });

  it('logout() limpia la sesion local aunque la llamada al backend falle', async () => {
    const accessToken = buildFakeAccessToken({
      sub: 'customer-4',
      companyId: 'c1',
      roles: [],
      actorType: 'Customer',
    });
    (getStoredCustomerTokens as jest.Mock).mockResolvedValue({ accessToken, refreshToken: 'r4' });
    (customerApiRequest as jest.Mock).mockRejectedValue(new Error('sin red'));

    render(
      <CustomerAuthProvider>
        <TestConsumer />
      </CustomerAuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    screen.getByText('logout').click();

    await waitFor(() => expect(clearStoredCustomerTokens).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
  });

  it('useCustomerAuth() fuera de CustomerAuthProvider tira un error explicito', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useCustomerAuth() debe usarse dentro de <CustomerAuthProvider>',
    );
    consoleError.mockRestore();
  });
});
