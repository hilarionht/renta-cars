import { Controller, Inject, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '@platform/persistence-kernel';
import {
  HandleGatewayWebhookHandler,
  STRIPE_WEBHOOK_TRANSLATOR_PORT,
  type StripeWebhookTranslatorPort,
} from '@platform/payments/application';

// docs/contracts/06-WEBHOOKS.md - fuera de /api/v1 (main.ts, setGlobalPrefix exclude),
// @Public() (sin Bearer, mismo mecanismo que /auth/login). Verifica firma PRIMERO (401 +
// descarta si es invalida, nunca procesa "por si acaso"), responde 200 rapido.
@Public()
@Controller('webhooks/v1/stripe')
export class StripeWebhookController {
  constructor(
    @Inject(STRIPE_WEBHOOK_TRANSLATOR_PORT)
    private readonly translator: StripeWebhookTranslatorPort,
    private readonly handleGatewayWebhook: HandleGatewayWebhookHandler,
  ) {}

  @Post()
  async handle(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    const signature = req.headers['stripe-signature'];
    if (!signature || Array.isArray(signature)) {
      throw new UnauthorizedException('Falta el header stripe-signature.');
    }
    if (!req.rawBody) {
      throw new UnauthorizedException('Falta el raw body de la request.');
    }

    const command = this.translator.verifyAndTranslateWebhook(req.rawBody, signature);
    if (command) {
      await this.handleGatewayWebhook.execute(command);
    }
    return { received: true };
  }
}
