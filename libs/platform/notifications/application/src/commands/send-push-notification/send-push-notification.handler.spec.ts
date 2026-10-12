import type { PushNotificationSenderPort } from '../../ports/push-notification-sender.port';
import { SendPushNotificationHandler } from './send-push-notification.handler';

describe('SendPushNotificationHandler', () => {
  it('reenvia el comando tal cual a PushNotificationSenderPort.sendPush', async () => {
    const pushNotificationSenderPort: PushNotificationSenderPort = {
      sendPush: jest.fn().mockResolvedValue({ providerReference: 'ticket-1' }),
    };
    const handler = new SendPushNotificationHandler(pushNotificationSenderPort);

    await handler.execute({
      deviceToken: 'ExponentPushToken[abc]',
      title: 'Titulo',
      body: 'Cuerpo',
      data: { reservationId: 'reservation-1' },
    });

    expect(pushNotificationSenderPort.sendPush).toHaveBeenCalledWith({
      deviceToken: 'ExponentPushToken[abc]',
      title: 'Titulo',
      body: 'Cuerpo',
      data: { reservationId: 'reservation-1' },
    });
  });

  it('propaga cualquier error de PushNotificationSenderPort.sendPush sin capturarlo', async () => {
    const error = new Error('boom');
    const pushNotificationSenderPort: PushNotificationSenderPort = {
      sendPush: jest.fn().mockRejectedValue(error),
    };
    const handler = new SendPushNotificationHandler(pushNotificationSenderPort);

    await expect(
      handler.execute({ deviceToken: 'ExponentPushToken[abc]', title: 't', body: 'b' }),
    ).rejects.toThrow(error);
  });
});
