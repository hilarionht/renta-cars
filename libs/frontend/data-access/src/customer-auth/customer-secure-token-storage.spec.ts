import * as SecureStore from 'expo-secure-store';

import {
  clearStoredCustomerTokens,
  getStoredCustomerTokens,
  setStoredCustomerTokens,
} from './customer-secure-token-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('customerSecureTokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getStoredCustomerTokens devuelve null si falta cualquiera de los 2 tokens', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-1')
      .mockResolvedValueOnce(null);

    const result = await getStoredCustomerTokens();

    expect(result).toBeNull();
  });

  it('getStoredCustomerTokens devuelve ambos tokens cuando estan presentes', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('access-1')
      .mockResolvedValueOnce('refresh-1');

    const result = await getStoredCustomerTokens();

    expect(result).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('setStoredCustomerTokens escribe ambos tokens bajo claves distintas de las de staff', async () => {
    await setStoredCustomerTokens({ accessToken: 'a', refreshToken: 'r' });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('renta_customer_access_token', 'a');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('renta_customer_refresh_token', 'r');
  });

  it('clearStoredCustomerTokens borra ambos tokens', async () => {
    await clearStoredCustomerTokens();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('renta_customer_access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('renta_customer_refresh_token');
  });
});
