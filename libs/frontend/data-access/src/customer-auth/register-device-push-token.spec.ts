import * as Notifications from 'expo-notifications';

import { customerApiRequest } from './customer-api-client';
import { registerDevicePushToken } from './register-device-push-token';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'project-1' } } },
}));

jest.mock('./customer-api-client', () => ({
  customerApiRequest: jest.fn(),
}));

describe('registerDevicePushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
