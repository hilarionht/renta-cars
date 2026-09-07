import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

import type {
  NotificationSenderInput,
  NotificationSenderResult,
} from '@platform/notifications/application';

interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
}

// docs/11-INTEGRACIONES.md SS4 - SDK oficial "@sendgrid/mail". templateId es el id de una
// dynamic template configurada del lado de SendGrid (p.ej. "d-abc123") - templateParams se
// mapean directo a dynamicTemplateData, sustituidos server-side por SendGrid. setApiKey() se
// llama en cada send() (no en el constructor) para no fallar el boot si SENDGRID_API_KEY esta
// vacio - mismo criterio de lazy-init que StripePaymentGatewayAdapter.
@Injectable()
export class EmailChannelSender {
  private readonly config: SendGridConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<SendGridConfig>('notifications.sendgrid');
  }

  async send(input: NotificationSenderInput): Promise<NotificationSenderResult> {
    if (!this.config.apiKey || !this.config.fromEmail) {
      throw new Error('SendGrid no esta configurado (SENDGRID_API_KEY/SENDGRID_FROM_EMAIL).');
    }
    if (!input.recipient.email) {
      throw new Error('Recipient sin email - no se puede enviar por Email.');
    }

    sgMail.setApiKey(this.config.apiKey);
    const [response] = await sgMail.send({
      to: input.recipient.email,
      from: this.config.fromEmail,
      templateId: input.templateId,
      dynamicTemplateData: input.templateParams,
    });

    const headers = response.headers as Record<string, string | undefined>;
    const providerReference = headers['x-message-id'];
    if (!providerReference) {
      throw new Error('SendGrid respondio sin x-message-id.');
    }
    return { providerReference };
  }
}
