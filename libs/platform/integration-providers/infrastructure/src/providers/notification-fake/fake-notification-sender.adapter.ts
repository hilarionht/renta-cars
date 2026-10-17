import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '@platform/persistence-kernel';
import type {
  NotificationSenderInput,
  NotificationSenderPort,
  NotificationSenderResult,
} from '@platform/notifications/application';

// Default de desarrollo/test (NOTIFICATION_SENDER_PROVIDER=fake) - determinista, siempre
// exitoso, sin latencia simulada, mismo criterio que FakePaymentGatewayAdapter. Reemplaza el
// compuesto entero (no cada canal por separado) para que el e2e sea determinista sin
// credenciales de ningun proveedor.
const FAIL_DELIVERY_DOMAIN = '@fail.invalid';

@Injectable()
export class FakeNotificationSenderAdapter implements NotificationSenderPort {
  constructor(private readonly prisma: PrismaService) {}

  async send(input: NotificationSenderInput): Promise<NotificationSenderResult> {
    // docs/persistence/10-DECISIONES.md #145: falla simulada para probar reintentos (el smoke
    // del recordatorio). Un email del dominio reservado `.invalid` falla en todos los canales y
    // no deja registro de envio.
    if (input.recipient.email?.toLowerCase().endsWith(FAIL_DELIVERY_DOMAIN)) {
      throw new Error(`Envio simulado fallido (destinatario ${FAIL_DELIVERY_DOMAIN}).`);
    }
    // Infra de test (docs/persistence/10-DECISIONES.md #113) - persiste lo que "enviaria"
    // para que un e2e recupere secretos que no se pueden fuerza-brutear (un token de reset
    // de 32 bytes). Nunca toca la tabla real de Notification (esa es legible via
    // GET /notifications) - fake_notification_sends no tiene ningun controller que la lea.
    await this.prisma.fakeNotificationSend.create({
      data: {
        channel: input.channel,
        templateId: input.templateId,
        recipientEmail: input.recipient.email,
        recipientPhone: input.recipient.phone,
        templateParams: input.templateParams,
      },
    });

    return { providerReference: `fake_${input.channel}_${randomUUID()}` };
  }
}
