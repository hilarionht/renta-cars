import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { customerApiRequest } from './customer-api-client';
import { registerDevicePushToken } from './register-device-push-token';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

// executionEnvironment mutable por test: 'storeClient' = Expo Go (#133). El objeto se crea
// dentro del factory (jest.mock se eleva por encima de cualquier const del modulo).
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'standalone',
    expoConfig: { extra: { eas: { projectId: 'project-1' } } },
  },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));

jest.mock('./customer-api-client', () => ({
  customerApiRequest: jest.fn(),
}));

const mockConstants = Constants as unknown as { executionEnvironment: string };

describe('registerDevicePushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.executionEnvironment = 'standalone';
  });

  // Regresion de docs/persistence/10-DECISIONES.md #133: en Expo Go (Android) importar
  // expo-notifications lanza al cargar - registerDevicePushToken() no debe tocarlo.
  it('en Expo Go no pide permisos, no obtiene token ni registra nada', async () => {
    mockConstants.executionEnvironment = 'storeClient';

    await registerDevicePushToken();

    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(customerApiRequest).not.toHaveBeenCalled();
  });

  it('si el permiso ya estaba concedido, no lo vuelve a pedir y registra el token', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc]',
    });

    await registerDevicePushToken();

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(customerApiRequest).toHaveBeenCalledWith('/api/v1/me/push-token', {
      method: 'PATCH',
      body: { deviceToken: 'ExponentPushToken[abc]' },
    });
  });

  it('si el permiso no estaba concedido, lo pide y registra el token si es aceptado', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[abc]',
    });

    await registerDevicePushToken();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(customerApiRequest).toHaveBeenCalledTimes(1);
  });

  it('si el permiso es denegado, no llama a getExpoPushTokenAsync ni registra nada', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await registerDevicePushToken();

    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(customerApiRequest).not.toHaveBeenCalled();
  });

  it('propaga cualquier error (el caller decide fire-and-forget)', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('sin soporte'));

    await expect(registerDevicePushToken()).rejects.toThrow('sin soporte');
  });
});
