import type { ConfigService } from '@nestjs/config';

import { PushTokenInvalidError } from '@platform/notifications/application';

import { PushSenderAdapter } from './push-sender.adapter';

const sendPushNotificationsAsync = jest.fn();
const isExpoPushToken = jest.fn();

jest.mock('expo-server-sdk', () => {
  class ExpoMock {
    sendPushNotificationsAsync = sendPushNotificationsAsync;
    static isExpoPushToken(token: string): boolean {
      return isExpoPushToken(token) as boolean;
    }
  }
  return { Expo: ExpoMock };
});

function buildAdapter(): PushSenderAdapter {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue({ accessToken: 'expo-access-token' }),
  } as unknown as ConfigService;
  return new PushSenderAdapter(configService);
}

describe('PushSenderAdapter', () => {
  beforeEach(() => {
    sendPushNotificationsAsync.mockReset();
    isExpoPushToken.mockReset();
  });

  it('tira PushTokenInvalidError si el deviceToken no tiene formato de Expo push token', async () => {
    isExpoPushToken.mockReturnValue(false);
    const adapter = buildAdapter();

    await expect(
      adapter.sendPush({ deviceToken: 'no-es-un-token', title: 't', body: 'b' }),
    ).rejects.toThrow(PushTokenInvalidError);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('tira PushTokenInvalidError si Expo responde DeviceNotRegistered', async () => {
    isExpoPushToken.mockReturnValue(true);
    sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'no registrado', details: { error: 'DeviceNotRegistered' } },
    ]);
    const adapter = buildAdapter();

    await expect(
      adapter.sendPush({ deviceToken: 'ExponentPushToken[abc]', title: 't', body: 'b' }),
    ).rejects.toThrow(PushTokenInvalidError);
  });

  it('tira un Error generico (no PushTokenInvalidError) ante cualquier otro codigo de error de Expo', async () => {
    isExpoPushToken.mockReturnValue(true);
    sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'rate exceeded', details: { error: 'MessageRateExceeded' } },
    ]);
    const adapter = buildAdapter();

    await expect(
      adapter.sendPush({ deviceToken: 'ExponentPushToken[abc]', title: 't', body: 'b' }),
    ).rejects.toThrow('Expo Push respondio con error: rate exceeded');
  });

  it('devuelve providerReference cuando Expo acepta el envio', async () => {
    isExpoPushToken.mockReturnValue(true);
    sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);
    const adapter = buildAdapter();

    const result = await adapter.sendPush({
      deviceToken: 'ExponentPushToken[abc]',
      title: 't',
      body: 'b',
    });

    expect(result).toEqual({ providerReference: 'ticket-1' });
  });
});
