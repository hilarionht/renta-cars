import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  NotificationSenderInput,
  NotificationSenderPort,
  NotificationSenderResult,
} from '@platform/notifications/application';

// Default de desarrollo/test (NOTIFICATION_SENDER_PROVIDER=fake) - determinista, siempre
// exitoso, sin latencia simulada, mismo criterio que FakePaymentGatewayAdapter. Reemplaza el
// compuesto entero (no cada canal por separado) para que el e2e sea determinista sin
// credenciales de ningun proveedor.
@Injectable()
export class FakeNotificationSenderAdapter implements NotificationSenderPort {
  send(input: NotificationSenderInput): Promise<NotificationSenderResult> {
    return Promise.resolve({ providerReference: `fake_${input.channel}_${randomUUID()}` });
  }
}
