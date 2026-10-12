import { ApiError, AuthenticationExpiredError, apiRequest } from './api-client';
import { getStoredTokens, setStoredTokens, clearStoredTokens } from './secure-token-storage';

// Factory explicita, nunca automock sin factory: automock igual requiere cargar el modulo
// real para inferir su forma, y secure-token-storage.ts importa expo-secure-store (ESM sin
// transformar bajo Jest fuera de apps/mobile - jest-expo no aplica aca).
jest.mock('./secure-token-storage', () => ({
  getStoredTokens: jest.fn(),
  setStoredTokens: jest.fn(),
  clearStoredTokens: jest.fn(),
}));

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    json: () => Promise.resolve(body),
  } as Response;
}

describe('apiRequest', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  it('adjunta Authorization con el accessToken guardado en una request protegida', async () => {
    (getStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { data: { ok: true } }));

    const result = await apiRequest<{ ok: boolean }>('/api/v1/reservations');

    expect(result).toEqual({ ok: true });
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer access-1');
    expect(options.headers['X-Client-Platform']).toBe('mobile');
  });

  it('requiresAuth:false no adjunta Authorization ni requiere tokens guardados', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(201, { data: { accessToken: 'x' } }),
    );

    await apiRequest('/api/v1/auth/login', { method: 'POST', requiresAuth: false });

    expect(getStoredTokens).not.toHaveBeenCalled();
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('sin tokens guardados y requiresAuth, tira AuthenticationExpiredError sin llamar a fetch', async () => {
    (getStoredTokens as jest.Mock).mockResolvedValue(null);

    await expect(apiRequest('/api/v1/reservations')).rejects.toThrow(AuthenticationExpiredError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ante 401, refresca el token y reintenta una vez - exito', async () => {
    (getStoredTokens as jest.Mock)
      .mockResolvedValueOnce({ accessToken: 'expired', refreshToken: 'refresh-1' })
      .mockResolvedValueOnce({ accessToken: 'expired', refreshToken: 'refresh-1' });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { accessToken: 'fresh', refreshToken: 'refresh-2' } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }));

    const result = await apiRequest<{ ok: boolean }>('/api/v1/reservations');

    expect(result).toEqual({ ok: true });
    expect(setStoredTokens).toHaveBeenCalledWith({
      accessToken: 'fresh',
      refreshToken: 'refresh-2',
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const [, retryOptions] = (global.fetch as jest.Mock).mock.calls[2];
    expect(retryOptions.headers.Authorization).toBe('Bearer fresh');
  });

  it('si el refresh tambien falla, limpia tokens y tira AuthenticationExpiredError', async () => {
    (getStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'expired',
      refreshToken: 'also-expired',
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(apiRequest('/api/v1/reservations')).rejects.toThrow(AuthenticationExpiredError);
    expect(clearStoredTokens).toHaveBeenCalled();
  });

  it('ante un error no-401, tira ApiError con el detail RFC 7807', async () => {
    (getStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(403, { title: 'Forbidden', detail: 'Falta el permiso X' }),
    );

    await expect(apiRequest('/api/v1/reservations')).rejects.toMatchObject({
      status: 403,
      message: 'Falta el permiso X',
    });
  });

  it('ApiError es distinguible de AuthenticationExpiredError', async () => {
    (getStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(500, { title: 'Error' }));

    try {
      await apiRequest('/api/v1/reservations');
      fail('deberia haber tirado');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).not.toBeInstanceOf(AuthenticationExpiredError);
    }
  });
});
