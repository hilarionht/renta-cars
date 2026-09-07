import { createHmac, timingSafeEqual } from 'node:crypto';

import { Controller, Get, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { Public } from '@platform/persistence-kernel';
import { HandleDeliveryConfirmationHandler } from '@platform/notifications/application';

interface WhatsAppStatusEntry {
  status: string;
  biz_opaque_callback_data?: string;
  errors?: { title?: string }[];
}

interface WhatsAppWebhookBody {
  entry?: {
    changes?: {
      value?: {
        statuses?: WhatsAppStatusEntry[];
      };
    }[];
  }[];
}

interface WhatsAppWebhookConfig {
  webhookVerifyToken: string;
  webhookSecret: string;
}

// docs/contracts/06-WEBHOOKS.md, Hallazgo #10 del plan - unico webhook de Notifications esta
// tanda (WhatsApp). GET: handshake de verificacion de suscripcion que exige Meta Cloud API
// (echo de hub.challenge). POST: fuera de /api/v1 (main.ts), @Public(), verifica
// X-Hub-Signature-256 (HMAC-SHA256 sobre el raw body con el App Secret) ANTES de procesar,
// traduce statuses[] a HandleDeliveryConfirmationHandler via biz_opaque_callback_data (unica
// forma de correlacionar sin lookup por referencia opaca). Sin traductor separado (a
// diferencia de Stripe/MercadoPago en Payments) - unico proveedor de webhook de
// Notifications esta tanda, no hay una segunda implementacion con la que compartir puerto.
@Public()
@Controller('webhooks/v1/whatsapp')
export class WhatsAppWebhookController {
  private readonly config: WhatsAppWebhookConfig;

  constructor(
    configService: ConfigService,
    private readonly handleDeliveryConfirmation: HandleDeliveryConfirmationHandler,
  ) {
    this.config = configService.getOrThrow<WhatsAppWebhookConfig>('notifications.whatsapp');
  }

  @Get()
  verifySubscription(@Query() query: Record<string, string>, @Res() res: Response): void {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken && challenge) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send();
  }

  @Post()
  async handle(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    const signatureHeader = req.headers['x-hub-signature-256'];
    if (!signatureHeader || Array.isArray(signatureHeader) || !req.rawBody) {
      throw new UnauthorizedException('Falta el header X-Hub-Signature-256 o el raw body.');
    }
    this.verifySignature(req.rawBody, signatureHeader);

    const body = req.body as WhatsAppWebhookBody;
    const statuses =
      body.entry
        ?.flatMap((entry) => entry.changes ?? [])
        .flatMap((change) => change.value?.statuses ?? []) ?? [];

    for (const status of statuses) {
      const correlation = this.parseCorrelation(status.biz_opaque_callback_data);
      if (!correlation) {
        continue;
      }
      if (status.status === 'delivered') {
        await this.handleDeliveryConfirmation.execute({
          notificationId: correlation.notificationId,
          companyId: correlation.companyId,
          outcome: 'delivered',
        });
      } else if (status.status === 'failed') {
        await this.handleDeliveryConfirmation.execute({
          notificationId: correlation.notificationId,
          companyId: correlation.companyId,
          outcome: 'failed',
          reason: status.errors?.[0]?.title,
        });
      }
    }

    return { received: true };
  }

  private verifySignature(rawBody: Buffer, signatureHeader: string): void {
    const expected = createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/, '');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(provided, 'hex');
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Firma de webhook de WhatsApp invalida.');
    }
  }

  private parseCorrelation(raw?: string): { notificationId: string; companyId: string } | null {
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { notificationId?: string; companyId?: string };
      if (!parsed.notificationId || !parsed.companyId) {
        return null;
      }
      return { notificationId: parsed.notificationId, companyId: parsed.companyId };
    } catch {
      return null;
    }
  }
}
