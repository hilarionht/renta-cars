import { ApiError, AuthenticationExpiredError } from './api-errors';

// Cliente HTTP agnostico de plataforma (docs/persistence/10-DECISIONES.md #134). Cada
// plataforma inyecta como obtener y renovar el access token:
//   - web: token en memoria + refresh por cookie httpOnly (credentials: 'include');
//   - mobile: tokens en SecureStore (sigue usando su propio cliente en @frontend/data-access).
// Ninguna pantalla llama fetch directo (docs/06-CONVENCIONES-FRONTEND.md SS6).

export interface PageMeta {
  nextCursor: string | null;
  limit: number;
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => string | null;
  // Debe renovar y devolver un access token nuevo, o lanzar AuthenticationExpiredError. La
  // serializacion (single-flight) es responsabilidad de quien la implementa.
  refreshAccessToken: () => Promise<string>;
  // 'include' en web para que el navegador mande/reciba la cookie refresh_token.
  credentials?: RequestCredentials;
  // Solo mobile manda 'mobile'; sin header el API trata al cliente como web (cookie).
  clientPlatform?: 'mobile';
  // Notificacion cuando la sesion ya no se puede recuperar (p.ej. redirigir a /login).
  onAuthenticationExpired?: () => void;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  // false para endpoints @Public() (login, refresh, forgot-password).
  requiresAuth?: boolean;
  query?: Record<string, string | number | undefined>;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  requestPage<T>(path: string, options?: RequestOptions): Promise<{ data: T[]; meta: PageMeta }>;
}

async function extractError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { detail?: string; title?: string; code?: string };
    return new ApiError(
      response.status,
      body.detail ?? body.title ?? response.statusText,
      body.code,
    );
  } catch {
    return new ApiError(response.status, response.statusText);
  }
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = `${baseUrl}${path}`;
  if (!query) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `${url}?${serialized}` : url;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  async function send(path: string, requestOptions: RequestOptions): Promise<Response> {
    const { method = 'GET', body, requiresAuth = true, query } = requestOptions;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.clientPlatform) {
      headers['X-Client-Platform'] = options.clientPlatform;
    }

    const doFetch = (accessToken: string | null) =>
      fetch(buildUrl(options.baseUrl, path, query), {
        method,
        headers: accessToken ? { ...headers, Authorization: `Bearer ${accessToken}` } : headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: options.credentials,
      });

    if (!requiresAuth) {
      return doFetch(null);
    }

    let accessToken = options.getAccessToken();
    if (!accessToken) {
      accessToken = await refreshOrExpire();
    }
    const response = await doFetch(accessToken);
    if (response.status !== 401) {
      return response;
    }
    // Un unico reintento con un token renovado - nunca un bucle.
    return doFetch(await refreshOrExpire());
  }

  async function refreshOrExpire(): Promise<string> {
    try {
      return await options.refreshAccessToken();
    } catch (error) {
      options.onAuthenticationExpired?.();
      throw error instanceof AuthenticationExpiredError ? error : new AuthenticationExpiredError();
    }
  }

  async function readEnvelope(response: Response): Promise<{ data: unknown; meta?: unknown }> {
    if (!response.ok) {
      throw await extractError(response);
    }
    if (response.status === 204) {
      return { data: undefined };
    }
    return (await response.json()) as { data: unknown; meta?: unknown };
  }

  return {
    async request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
      const envelope = await readEnvelope(await send(path, requestOptions));
      return envelope.data as T;
    },
    async requestPage<T>(
      path: string,
      requestOptions: RequestOptions = {},
    ): Promise<{ data: T[]; meta: PageMeta }> {
      const envelope = await readEnvelope(await send(path, requestOptions));
      const meta = envelope.meta as Partial<PageMeta> | undefined;
      return {
        data: envelope.data as T[],
        meta: { nextCursor: meta?.nextCursor ?? null, limit: meta?.limit ?? 0 },
      };
    },
  };
}
