// docs/06-CONVENCIONES-FRONTEND.md SS5 / docs/09-SEGURIDAD.md SS1: mobile guarda ambos
// tokens en almacenamiento seguro del dispositivo (SecureStore/Keychain), nunca en
// localStorage/AsyncStorage plano - "Nunca en localStorage" es explicito en el propio doc
// de seguridad. Mobile-only: web-admin usa cookie httpOnly server-side (mecanismo distinto,
// no expuesto por este modulo).
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'renta_access_token';
const REFRESH_TOKEN_KEY = 'renta_refresh_token';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export async function setStoredTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearStoredTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
