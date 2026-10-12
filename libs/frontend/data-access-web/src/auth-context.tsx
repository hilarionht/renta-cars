'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  AuthenticationExpiredError,
  createApiClient,
  type ApiClient,
} from '@frontend/data-access-core';
import type { WebAuthResponse, WebLoginResponse } from '@frontend/domain-types';

import { createRefreshCoordinator } from './refresh-coordinator';
import { clearSessionIndicator, hasSessionIndicator, markSessionActive } from './session-indicator';

// Sesion del personal en la web (docs/09-SEGURIDAD.md SS1, docs/persistence/10-DECISIONES.md
// #134): access token SOLO en memoria (un ref, nunca localStorage); refresh token en la cookie
// httpOnly que emite el API (credentials: 'include', sin X-Client-Platform). Al recargar la
// pagina el token en memoria se pierde y se recupera con un refresh silencioso.

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface LoginInput {
  companyId: string;
  email: string;
  password: string;
}

export type LoginResult = { mfaRequired: false } | { mfaRequired: true; mfaChallengeId: string };

interface WebAuthContextValue {
  status: AuthStatus;
  api: ApiClient;
  login(input: LoginInput): Promise<LoginResult>;
  verifyMfa(input: { companyId: string; mfaChallengeId: string; code: string }): Promise<void>;
  logout(): Promise<void>;
}

const webAuthContext = createContext<WebAuthContextValue | null>(null);

export function WebAuthProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const accessTokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const { api, refresh } = useMemo(() => {
    // Cliente sin autenticacion para login/refresh/logout (@Public() en el API).
    const publicApi = createApiClient({
      baseUrl,
      credentials: 'include',
      getAccessToken: () => null,
      refreshAccessToken: () => Promise.reject(new AuthenticationExpiredError()),
    });

    const refreshCoordinated = createRefreshCoordinator(async () => {
      try {
        const result = await publicApi.request<WebAuthResponse>('/api/v1/auth/refresh', {
          method: 'POST',
          body: {},
          requiresAuth: false,
        });
        accessTokenRef.current = result.accessToken;
        markSessionActive();
        return result.accessToken;
      } catch {
        accessTokenRef.current = null;
        clearSessionIndicator();
        throw new AuthenticationExpiredError();
      }
    });

    const authenticatedApi = createApiClient({
      baseUrl,
      credentials: 'include',
      getAccessToken: () => accessTokenRef.current,
      refreshAccessToken: refreshCoordinated,
      onAuthenticationExpired: () => setStatus('anonymous'),
    });

    return { api: authenticatedApi, refresh: refreshCoordinated };
  }, [baseUrl]);

  // Recupera la sesion al cargar la pagina, solo si este navegador tuvo un login (evita un
  // 401 innecesario en cada visita anonima).
  useEffect(() => {
    if (!hasSessionIndicator()) {
      setStatus('anonymous');
      return;
    }
    refresh()
      .then(() => setStatus('authenticated'))
      .catch(() => setStatus('anonymous'));
  }, [refresh]);

  const startSession = useCallback((accessToken: string) => {
    accessTokenRef.current = accessToken;
    markSessionActive();
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (input: LoginInput): Promise<LoginResult> => {
      const result = await api.request<WebLoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: input,
        requiresAuth: false,
      });
      if ('mfaRequired' in result) {
        return { mfaRequired: true, mfaChallengeId: result.mfaChallengeId };
      }
      startSession(result.accessToken);
      return { mfaRequired: false };
    },
    [api, startSession],
  );

  const verifyMfa = useCallback(
    async (input: { companyId: string; mfaChallengeId: string; code: string }) => {
      const result = await api.request<WebAuthResponse>('/api/v1/auth/mfa/verify', {
        method: 'POST',
        body: input,
        requiresAuth: false,
      });
      startSession(result.accessToken);
    },
    [api, startSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.request('/api/v1/auth/logout', { method: 'POST', body: {}, requiresAuth: false });
    } finally {
      accessTokenRef.current = null;
      clearSessionIndicator();
      queryClient.clear();
      setStatus('anonymous');
    }
  }, [api, queryClient]);

  const value = useMemo(
    () => ({ status, api, login, verifyMfa, logout }),
    [status, api, login, verifyMfa, logout],
  );

  return <webAuthContext.Provider value={value}>{children}</webAuthContext.Provider>;
}

export function useWebAuth(): WebAuthContextValue {
  const context = useContext(webAuthContext);
  if (!context) {
    throw new Error('useWebAuth debe usarse dentro de <WebAuthProvider>.');
  }
  return context;
}
