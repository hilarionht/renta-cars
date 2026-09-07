import { Controller, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '@platform/persistence-kernel';
import {
  HandleGatewayWebhookHandler,
  MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT,
  type MercadoPagoWebhookTranslatorPort,
} from '@platform/payments/application';

// docs/contracts/06-WEBHOOKS.md - fuera de /api/v1, @Public(). dataId viaja en el query
// string (?data.id=...&type=payment, contrato documentado de Mercado Pago), no en el body.
@Public()
@Controller('webhooks/v1/mercadopago')
export class MercadoPagoWebhookController {
  constructor(
    @Inject(MERCADOPAGO_WEBHOOK_TRANSLATOR_PORT)
    private readonly translator: MercadoPagoWebhookTranslatorPort,
    private readonly handleGatewayWebhook: HandleGatewayWebhookHandler,
  ) {}

  @Post()
  async handle(@Req() req: Request): Promise<{ received: true }> {
    const command = await this.translator.verifyAndTranslateWebhook(
      req.body as { data?: { id?: string } },
      {
        xSignature: req.headers['x-signature'],
        xRequestId: req.headers['x-request-id'],
        dataId: req.query['data.id'] as string | string[] | undefined,
      },
    );
    if (command) {
      await this.handleGatewayWebhook.execute(command);
    }
    return { received: true };
  }
}
