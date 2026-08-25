import * as SecureStore from 'expo-secure-store';

import { clearStoredTokens, getStoredTokens, setStoredTokens } from './secure-token-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('secureTokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getStoredTokens devuelve null si falta cualquiera de los 2 tokens', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-1')
      .mockResolvedValueOnce(null);

    const result = await getStoredTokens();

    expect(result).toBeNull();
  });

  it('getStoredTokens devuelve ambos tokens cuando estan presentes', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-1')
      .mockResolvedValueOnce('refresh-1');

    const result = await getStoredTokens();

    expect(result).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('setStoredTokens escribe ambos tokens', async () => {
    await setStoredTokens({ accessToken: 'a', refreshToken: 'r' });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('renta_access_token', 'a');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('renta_refresh_token', 'r');
  });

  it('clearStoredTokens borra ambos tokens', async () => {
    await clearStoredTokens();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('renta_access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('renta_refresh_token');
  });
});
