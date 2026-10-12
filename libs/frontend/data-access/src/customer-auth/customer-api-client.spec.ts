import { ApiError, AuthenticationExpiredError } from '../shared/api-errors';
import { customerApiRequest } from './customer-api-client';
import {
  getStoredCustomerTokens,
  setStoredCustomerTokens,
  clearStoredCustomerTokens,
} from './customer-secure-token-storage';

// ApiError/AuthenticationExpiredError importadas de ../shared/api-errors (sin imports
// propios) - nunca de ../auth/api-client, que arrastraria expo-secure-store via
// secure-token-storage.ts. Factory explicita para el unico mock real de esta suite, nunca
// automock sin factory - mismo motivo que api-client.spec.ts.
jest.mock('./customer-secure-token-storage', () => ({
  getStoredCustomerTokens: jest.fn(),
  setStoredCustomerTokens: jest.fn(),
  clearStoredCustomerTokens: jest.fn(),
}));

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    json: () => Promise.resolve(body),
  } as Response;
}

describe('customerApiRequest', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  it('adjunta Authorization con el accessToken de cliente guardado en una request protegida', async () => {
    (getStoredCustomerTokens as jest.Mock).mockResolvedValue({
      accessToken: 'customer-access-1',
      refreshToken: 'customer-refresh-1',
    });
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { data: { ok: true } }));

    const result = await customerApiRequest<{ ok: boolean }>('/api/v1/me/reservations');

    expect(result).toEqual({ ok: true });
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer customer-access-1');
    expect(options.headers['X-Client-Platform']).toBe('mobile');
  });

  it('requiresAuth:false (otp/request) no adjunta Authorization ni requiere tokens guardados', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(201, { data: undefined }));

    await customerApiRequest('/api/v1/customers/auth/otp/request', {
      method: 'POST',
      requiresAuth: false,
    });

    expect(getStoredCustomerTokens).not.toHaveBeenCalled();
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('sin tokens de cliente guardados y requiresAuth, tira AuthenticationExpiredError sin llamar a fetch', async () => {
    (getStoredCustomerTokens as jest.Mock).mockResolvedValue(null);

    await expect(customerApiRequest('/api/v1/me/reservations')).rejects.toThrow(
      AuthenticationExpiredError,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ante 401, refresca contra /api/v1/customers/auth/refresh y reintenta una vez - exito', async () => {
    (getStoredCustomerTokens as jest.Mock)
      .mockResolvedValueOnce({ accessToken: 'expired', refreshToken: 'refresh-1' })
      .mockResolvedValueOnce({ accessToken: 'expired', refreshToken: 'refresh-1' });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { accessToken: 'fresh', refreshToken: 'refresh-2' } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }));

    const result = await customerApiRequest<{ ok: boolean }>('/api/v1/me/reservations');

    expect(result).toEqual({ ok: true });
    expect(setStoredCustomerTokens).toHaveBeenCalledWith({
      accessToken: 'fresh',
      refreshToken: 'refresh-2',
    });
    const [refreshUrl] = (global.fetch as jest.Mock).mock.calls[1];
    expect(refreshUrl).toBe('http://api.test/api/v1/customers/auth/refresh');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const [, retryOptions] = (global.fetch as jest.Mock).mock.calls[2];
    expect(retryOptions.headers.Authorization).toBe('Bearer fresh');
  });

  it('si el refresh de cliente tambien falla, limpia tokens de cliente y tira AuthenticationExpiredError', async () => {
    (getStoredCustomerTokens as jest.Mock).mockResolvedValue({
      accessToken: 'expired',
      refreshToken: 'also-expired',
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(customerApiRequest('/api/v1/me/reservations')).rejects.toThrow(
      AuthenticationExpiredError,
    );
    expect(clearStoredCustomerTokens).toHaveBeenCalled();
  });

  it('ante un error no-401, tira ApiError con el detail RFC 7807 (reusa la clase de staff)', async () => {
    (getStoredCustomerTokens as jest.Mock).mockResolvedValue({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(404, { title: 'Not found', detail: 'No existe la reservation' }),
    );

    try {
      await customerApiRequest('/api/v1/me/reservations/unknown');
      fail('deberia haber tirado');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 404, message: 'No existe la reservation' });
    }
  });
});
