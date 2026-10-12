// Espejo de auth/api-client.ts - duplicado a proposito (mismo criterio que CustomerSession/
// Session en el backend, docs/persistence/10-DECISIONES.md #109: apiRequest son ~110 lineas,
// mismo tamaño/riesgo que SessionSecurityService alla - un bug en un mecanismo nunca debe
// tocar al otro). Reusa (no duplica) ApiError/AuthenticationExpiredError de
// ../shared/api-errors (clases genericas sin imports propios, ver ese archivo - importarlas
// desde auth/api-client.ts arrastraria su cadena de imports hasta expo-secure-store) y
// getApiBaseUrl de ../shared/api-base-url (lectura de env pura). Refresh apunta a
// /api/v1/customers/auth/refresh, nunca /api/v1/auth/refresh.
import type { AuthResponse } from '@frontend/domain-types';

import { ApiError, AuthenticationExpiredError } from '../shared/api-errors';
import { getApiBaseUrl } from '../shared/api-base-url';
import {
  clearStoredCustomerTokens,
  getStoredCustomerTokens,
  setStoredCustomerTokens,
} from './customer-secure-token-storage';

async function refreshCustomerTokens(): Promise<string> {
  const stored = await getStoredCustomerTokens();
  if (!stored) {
    throw new AuthenticationExpiredError();
  }
  const response = await fetch(`${getApiBaseUrl()}/api/v1/customers/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
  });
  if (!response.ok) {
    await clearStoredCustomerTokens();
    throw new AuthenticationExpiredError();
  }
  const body = (await response.json()) as { data: AuthResponse };
  await setStoredCustomerTokens(body.data);
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

// requiresAuth: false para otp/request y otp/verify (@Public(), sin token todavia).
export async function customerApiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; requiresAuth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, requiresAuth = true } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile',
  };

  if (requiresAuth) {
    const stored = await getStoredCustomerTokens();
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
    const newAccessToken = await refreshCustomerTokens();
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
