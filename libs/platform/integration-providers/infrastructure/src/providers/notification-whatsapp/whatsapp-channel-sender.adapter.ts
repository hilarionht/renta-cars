import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  NotificationSenderInput,
  NotificationSenderResult,
} from '@platform/notifications/application';

interface WhatsAppConfig {
  apiToken: string;
  phoneNumberId: string;
}

interface WhatsAppSendResponse {
  messages?: { id: string }[];
}

// docs/11-INTEGRACIONES.md SS3 - Meta Cloud API, sin SDK oficial de Node - llamada HTTP directa
// (fetch nativo, Node >=20). templateId es el nombre de una plantilla aprobada por Meta
// (requisito de la API fuera de la ventana de 24h) - templateParams se mapean 1:1 a los
// parametros de texto del body de la plantilla, en el orden en que Object.values() los
// itera (sin un catalogo de plantillas documentado que fije el orden explicito - gap de
// alcance, ver docs/persistence/10-DECISIONES.md Fase 3).
// biz_opaque_callback_data viaja ida y vuelta hasta el webhook de estado (Hallazgo del plan)
// - unica forma de correlacionar sin lookup por referencia opaca.
@Injectable()
export class WhatsAppChannelSender {
  private readonly config: WhatsAppConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<WhatsAppConfig>('notifications.whatsapp');
  }

  async send(input: NotificationSenderInput): Promise<NotificationSenderResult> {
    if (!this.config.apiToken || !this.config.phoneNumberId) {
      throw new Error(
        'WhatsApp no esta configurado (WHATSAPP_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID).',
      );
    }
    if (!input.recipient.phone) {
      throw new Error('Recipient sin telefono - no se puede enviar por WhatsApp.');
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: input.recipient.phone.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: input.templateId,
            language: { code: 'es_MX' },
            components: [
              {
                type: 'body',
                parameters: Object.values(input.templateParams).map((value) => ({
                  type: 'text',
                  text: value,
                })),
              },
            ],
          },
          biz_opaque_callback_data: JSON.stringify({
            notificationId: input.notificationId,
            companyId: input.companyId,
          }),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`WhatsApp Cloud API respondio ${response.status}: ${await response.text()}`);
    }

    const body = (await response.json()) as WhatsAppSendResponse;
    const providerReference = body.messages?.[0]?.id;
    if (!providerReference) {
      throw new Error('WhatsApp Cloud API respondio sin id de mensaje.');
    }
    return { providerReference };
  }
}
