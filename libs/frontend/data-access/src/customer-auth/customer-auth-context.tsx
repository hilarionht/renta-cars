// Espejo de auth/auth-context.tsx - duplicado a proposito, ver customer-api-client.ts. Forma
// distinta a AuthProvider/useAuth(): no hay un unico login(), el login de cliente es 2 pasos
// (requestOtp -> verifyOtp) sin password. requestOtp() nunca cambia la sesion (fire-and-
// forget salvo error) - solo verifyOtp() la establece, mismo patron que login() de staff.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  AuthResponse,
  RequestCustomerOtpRequest,
  VerifyCustomerOtpRequest,
} from '@frontend/domain-types';

import { type AccessTokenClaims, decodeAccessToken } from '../auth/decode-access-token';
import { customerApiRequest } from './customer-api-client';
import {
  clearStoredCustomerTokens,
  getStoredCustomerTokens,
  setStoredCustomerTokens,
} from './customer-secure-token-storage';

interface CustomerAuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  customer: AccessTokenClaims | null;
  requestOtp: (params: RequestCustomerOtpRequest) => Promise<void>;
  verifyOtp: (params: VerifyCustomerOtpRequest) => Promise<void>;
  logout: () => Promise<void>;
}

// PascalCase intencional: convencion de React para objetos Context.
// eslint-disable-next-line @typescript-eslint/naming-convention
const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [customer, setCustomer] = useState<AccessTokenClaims | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getStoredCustomerTokens().then((stored) => {
      if (!cancelled) {
        setCustomer(stored ? decodeAccessToken(stored.accessToken) : null);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestOtp = useCallback(async (params: RequestCustomerOtpRequest) => {
    await customerApiRequest('/api/v1/customers/auth/otp/request', {
      method: 'POST',
      body: params,
      requiresAuth: false,
    });
  }, []);

  const verifyOtp = useCallback(async (params: VerifyCustomerOtpRequest) => {
    const auth = await customerApiRequest<AuthResponse>('/api/v1/customers/auth/otp/verify', {
      method: 'POST',
      body: params,
      requiresAuth: false,
    });
    await setStoredCustomerTokens(auth);
    setCustomer(decodeAccessToken(auth.accessToken));
  }, []);

  const logout = useCallback(async () => {
    const stored = await getStoredCustomerTokens();
    if (stored) {
      try {
        await customerApiRequest('/api/v1/customers/auth/logout', {
          method: 'POST',
          body: { refreshToken: stored.refreshToken },
          requiresAuth: false,
        });
      } catch {
        // Logout local igual procede aunque la llamada al backend falle - mismo criterio
        // que auth-context.tsx de staff.
      }
    }
    await clearStoredCustomerTokens();
    setCustomer(null);
  }, []);

  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: customer !== null,
      customer,
      requestOtp,
      verifyOtp,
      logout,
    }),
    [isLoading, customer, requestOtp, verifyOtp, logout],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth() debe usarse dentro de <CustomerAuthProvider>.');
  }
  return context;
}
