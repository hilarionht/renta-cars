import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

import type {
  NotificationSenderInput,
  NotificationSenderResult,
} from '@platform/notifications/application';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

// docs/11-INTEGRACIONES.md SS4 - SDK oficial "twilio". A diferencia de WhatsApp (plantillas
// aprobadas por Meta) y SendGrid (dynamic templates del lado del proveedor), la API base de
// Messages de Twilio no tiene un mecanismo de plantillas del lado del servidor - sin un
// catalogo de copy/plantillas documentado en ningun lugar del repo (gap de alcance, ver
// docs/persistence/10-DECISIONES.md Fase 3), el body se toma de templateParams.body tal cual
// (el caller ya lo compuso) con un fallback minimo si falta - documentado explicitamente, no
// una omision.
@Injectable()
export class SmsChannelSender {
  private readonly config: TwilioConfig;
  private lazyClient?: Twilio.Twilio;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<TwilioConfig>('notifications.twilio');
  }

  private get client(): Twilio.Twilio {
    if (!this.config.accountSid || !this.config.authToken || !this.config.fromNumber) {
      throw new Error(
        'Twilio no esta configurado (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER).',
      );
    }
    if (!this.lazyClient) {
      this.lazyClient = Twilio(this.config.accountSid, this.config.authToken);
    }
    return this.lazyClient;
  }

  async send(input: NotificationSenderInput): Promise<NotificationSenderResult> {
    if (!input.recipient.phone) {
      throw new Error('Recipient sin telefono - no se puede enviar por SMS.');
    }

    const message = await this.client.messages.create({
      to: input.recipient.phone,
      from: this.config.fromNumber,
      body: input.templateParams.body ?? `Notificacion: ${input.templateId}`,
    });

    return { providerReference: message.sid };
  }
}
