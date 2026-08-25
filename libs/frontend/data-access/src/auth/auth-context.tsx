// docs/06-CONVENCIONES-FRONTEND.md SS5: sesion/auth = "Context ligero + almacenamiento
// seguro" - no React Query (no es server state cacheable/invalidable, es la sesion misma) y
// no una libreria de estado global (Redux/Zustand, explicitamente rechazadas por el mismo
// doc).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AuthResponse, LoginRequest } from '@frontend/domain-types';

import { apiRequest } from './api-client';
import { type AccessTokenClaims, decodeAccessToken } from './decode-access-token';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './secure-token-storage';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AccessTokenClaims | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

// PascalCase intencional: convencion de React para objetos Context (se usa como
// <AuthContext.Provider>, mismo criterio que un componente).
// eslint-disable-next-line @typescript-eslint/naming-convention
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AccessTokenClaims | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Sesion previa en SecureStore (app reabierta) - se lee sin llamar a /auth/refresh: si
    // el accessToken todavia es valido, apiRequest lo usa directo; si expiro, la primer
    // request protegida dispara el flujo de refresh de api-client.ts.
    void getStoredTokens().then((stored) => {
      if (!cancelled) {
        setUser(stored ? decodeAccessToken(stored.accessToken) : null);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const auth = await apiRequest<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: credentials,
      requiresAuth: false,
    });
    await setStoredTokens(auth);
    setUser(decodeAccessToken(auth.accessToken));
  }, []);

  const logout = useCallback(async () => {
    // Revoca la sesion server-side (docs/09-SEGURIDAD.md SS4: "revocacion de sesion" es
    // evento de auditoria) - no solo borra el token local, que dejaria el refreshToken
    // robado/filtrado igual de valido hasta su expiracion natural.
    const stored = await getStoredTokens();
    if (stored) {
      try {
        await apiRequest('/api/v1/auth/logout', {
          method: 'POST',
          body: { refreshToken: stored.refreshToken },
          requiresAuth: false,
        });
      } catch {
        // Logout local igual procede aunque la llamada al backend falle (sin red, backend
        // caido) - la sesion local no debe quedar pegada por un problema de conectividad.
      }
    }
    await clearStoredTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isLoading, isAuthenticated: user !== null, user, login, logout }),
    [isLoading, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() debe usarse dentro de <AuthProvider>.');
  }
  return context;
}
