import { Injectable } from '@nestjs/common';

import type {
  NotificationSenderInput,
  NotificationSenderPort,
  NotificationSenderResult,
} from '@platform/notifications/application';

import { EmailChannelSender } from '../notification-email/email-channel-sender.adapter';
import { SmsChannelSender } from '../notification-sms/sms-channel-sender.adapter';
import { WhatsAppChannelSender } from '../notification-whatsapp/whatsapp-channel-sender.adapter';

// Compuesto (Hallazgo #9 del plan) - a diferencia de PaymentGatewayPort (Stripe/MercadoPago,
// se activa UNO por config), aca los 3 canales estan simultaneamente activos en modo "real":
// este adaptador nunca decide el canal, solo enruta el que SendNotificationHandler ya eligio
// (input.channel) hacia el sub-adaptador de un solo canal correspondiente.
@Injectable()
export class NotificationSenderAdapter implements NotificationSenderPort {
  constructor(
    private readonly whatsAppChannelSender: WhatsAppChannelSender,
    private readonly emailChannelSender: EmailChannelSender,
    private readonly smsChannelSender: SmsChannelSender,
  ) {}

  send(input: NotificationSenderInput): Promise<NotificationSenderResult> {
    switch (input.channel) {
      case 'WhatsApp':
        return this.whatsAppChannelSender.send(input);
      case 'Email':
        return this.emailChannelSender.send(input);
      case 'SMS':
        return this.smsChannelSender.send(input);
    }
  }
}
