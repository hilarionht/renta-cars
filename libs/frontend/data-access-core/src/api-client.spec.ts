import { createApiClient } from './api-client';
import { ApiError, AuthenticationExpiredError } from './api-errors';

// docs/persistence/10-DECISIONES.md #134.
function jsonResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('createApiClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  function build(overrides: Partial<Parameters<typeof createApiClient>[0]> = {}) {
    const options = {
      baseUrl: 'http://api.test',
      getAccessToken: jest.fn(() => 'token-1'),
      refreshAccessToken: jest.fn(() => Promise.resolve('token-2')),
      onAuthenticationExpired: jest.fn(),
      ...overrides,
    };
    return { client: createApiClient(options), options };
  }

  it('agrega el Bearer y devuelve data del envelope', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { id: 'x' } }));
    const { client } = build({ credentials: 'include' });

    const result = await client.request<{ id: string }>('/api/v1/users/me');

    expect(result).toEqual({ id: 'x' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/users/me');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
    expect(init.credentials).toBe('include');
    // Sin clientPlatform no se manda X-Client-Platform: el API trata al cliente como web.
    expect((init.headers as Record<string, string>)['X-Client-Platform']).toBeUndefined();
  });

  it('ante un 401 renueva el token y reintenta UNA sola vez', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }));
    const { client, options } = build();

    await expect(client.request('/api/v1/x')).resolves.toBe('ok');

    expect(options.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });

  it('si el reintento vuelve a dar 401, no entra en bucle y propaga el error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { title: 'Unauthorized' }));
    const { client, options } = build();

    await expect(client.request('/api/v1/x')).rejects.toBeInstanceOf(ApiError);
    expect(options.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('si el refresh falla, avisa la expiracion y lanza AuthenticationExpiredError', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401));
    const { client, options } = build({
      refreshAccessToken: jest.fn(() => Promise.reject(new Error('cookie invalida'))),
    });

    await expect(client.request('/api/v1/x')).rejects.toBeInstanceOf(AuthenticationExpiredError);
    expect(options.onAuthenticationExpired).toHaveBeenCalledTimes(1);
  });

  it('sin access token en memoria, renueva antes del primer request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: 1 }));
    const { client, options } = build({ getAccessToken: jest.fn(() => null) });

    await client.request('/api/v1/x');

    expect(options.refreshAccessToken).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });

  it('requiresAuth: false no adjunta token ni intenta renovar', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { data: { accessToken: 'a' } }));
    const { client, options } = build();

    await client.request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'x' },
      requiresAuth: false,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.body).toBe(JSON.stringify({ email: 'x' }));
    expect(options.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('traduce el problem details a ApiError con status y code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { detail: 'No disponible', code: 'VEHICLE_NOT_AVAILABLE' }),
    );
    const { client } = build();

    const error = (await client.request('/api/v1/x').catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('No disponible');
    expect(error.code).toBe('VEHICLE_NOT_AVAILABLE');
  });

  it('requestPage devuelve data y meta, y arma la query omitiendo vacios', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: [{ id: 'u1' }], meta: { nextCursor: 'c2', limit: 25 } }),
    );
    const { client } = build();

    const page = await client.requestPage<{ id: string }>('/api/v1/users', {
      query: { limit: 25, cursor: undefined, status: '' },
    });

    expect(page).toEqual({ data: [{ id: 'u1' }], meta: { nextCursor: 'c2', limit: 25 } });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/v1/users?limit=25');
  });

  it('una respuesta 204 devuelve undefined', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204));
    const { client } = build();

    await expect(client.request('/api/v1/x', { method: 'POST' })).resolves.toBeUndefined();
  });
});
