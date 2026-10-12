import { Inject, Injectable } from '@nestjs/common';

import {
  PUSH_NOTIFICATION_SENDER_PORT,
  type PushNotificationSenderPort,
} from '../../ports/push-notification-sender.port';
import type { SendPushNotificationCommand } from './send-push-notification.command';

// Unico camino permitido hacia PUSH_NOTIFICATION_SENDER_PORT (docs/contracts/
// 05-INTEGRATION-CONTRACTS.md SS2: "Consumido por: notifications", boundaries.mjs bloquea a
// scope:platform de depender de scope:product-rental - notifications no puede resolver el
// deviceToken por si sola, de ahi que este handler quede generico). Passthrough puro, sin
// try/catch propio - el caller (SendReservationReminderProcessor) decide la politica de error
// (best-effort, distingue PushTokenInvalidError de cualquier otro fallo).
@Injectable()
export class SendPushNotificationHandler {
  constructor(
    @Inject(PUSH_NOTIFICATION_SENDER_PORT)
    private readonly pushNotificationSenderPort: PushNotificationSenderPort,
  ) {}

  async execute(command: SendPushNotificationCommand): Promise<void> {
    await this.pushNotificationSenderPort.sendPush(command);
  }
}
