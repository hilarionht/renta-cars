// Espejo de auth/secure-token-storage.ts - duplicado a proposito, ver customer-api-client.ts.
// Claves DISTINTAS de las de staff (nunca renta_access_token/renta_refresh_token) - ambas
// sesiones pueden coexistir en un mismo dispositivo (p.ej. QA probando los 2 flujos).
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'renta_customer_access_token';
const REFRESH_TOKEN_KEY = 'renta_customer_refresh_token';

export interface StoredCustomerTokens {
  accessToken: string;
  refreshToken: string;
}

export async function getStoredCustomerTokens(): Promise<StoredCustomerTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export async function setStoredCustomerTokens(tokens: StoredCustomerTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearStoredCustomerTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
