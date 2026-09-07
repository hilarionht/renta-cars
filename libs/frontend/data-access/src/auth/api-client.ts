// docs/06-CONVENCIONES-FRONTEND.md SS6: ninguna pantalla llama fetch directo - todo pasa
// por este cliente. Agrega Authorization + X-Client-Platform: mobile (CLIENT_PLATFORM_HEADER
// del backend, docs/08-API-CONTRACTS.md SS9.1 - mobile siempre recibe accessToken+
// refreshToken en el body, nunca cookie) y reintenta una vez con refresh ante 401.
//
// Sin estado en modulo (a diferencia de un singleton con tokens en memoria): cada llamada
// lee SecureStore directo - mas simple que sincronizar con el estado de React del
// AuthContext, y de todos modos SecureStore ya es la fuente de verdad.
import type { AuthResponse } from '@frontend/domain-types';

import { ApiError, AuthenticationExpiredError } from '../shared/api-errors';
import { getApiBaseUrl } from '../shared/api-base-url';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './secure-token-storage';

export { ApiError, AuthenticationExpiredError };

async function refreshTokens(): Promise<string> {
  const stored = await getStoredTokens();
  if (!stored) {
    throw new AuthenticationExpiredError();
  }
  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
  });
  if (!response.ok) {
    await clearStoredTokens();
    throw new AuthenticationExpiredError();
  }
  const body = (await response.json()) as { data: AuthResponse };
  await setStoredTokens(body.data);
  return body.data.accessToken;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string; title?: string };
    return body.detail ?? body.title ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

// requiresAuth: false para login (@Public(), sin token todavia que adjuntar).
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; requiresAuth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, requiresAuth = true } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile',
  };

  if (requiresAuth) {
    const stored = await getStoredTokens();
    if (!stored) {
      throw new AuthenticationExpiredError();
    }
    headers.Authorization = `Bearer ${stored.accessToken}`;
  }

  const doFetch = () =>
    fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await doFetch();

  if (response.status === 401 && requiresAuth) {
    const newAccessToken = await refreshTokens();
    headers.Authorization = `Bearer ${newAccessToken}`;
    response = await doFetch();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const envelope = (await response.json()) as { data: T };
  return envelope.data;
}
