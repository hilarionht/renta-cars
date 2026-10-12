import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import { SendNotificationHandler } from '@platform/notifications/application';

// Forma local del payload de UserCreated.v1 - notifications/infrastructure (scope:platform)
// no puede importar @platform/users/domain (tooling/eslint/boundaries.mjs), asi que se
// duplica el subconjunto de campos que este listener necesita, documentado contra
// docs/model/06-DOMAIN_EVENTS.md SS3 - mismo criterio de duplicacion ya usado en toda la
// sesion (ReservationConfirmedPayload en SecurityDepositHoldListener, etc.).
interface UserCreatedPayload {
  email: string;
}

// Unico listener de evento de negocio real esta tanda (Hallazgo #1/#11 del plan) - prueba el
// mecanismo de punta a punta sin adelantarse al alcance que el roadmap reserva para conectar
// Reservations/Payments/Invoices (item 3 de Fase 3, explicitamente diferido). Reutiliza
// kind: 'Alert' (User es personal interno, no un Customer - docs/domain/02-LENGUAJE-
// UBICUO.md SS8). Fire-and-forget (OutboxWriter usa EventEmitter2.emit(), nunca
// emitAsync()) - mismo criterio que SecurityDepositHoldListener.
@Injectable()
export class UserWelcomeNotificationListener {
  private readonly logger = new Logger(UserWelcomeNotificationListener.name);

  constructor(private readonly sendNotification: SendNotificationHandler) {}

  @OnEvent('UserCreated.v1')
  async handle(event: DomainEventEmitted): Promise<void> {
    const companyId = event.companyId;
    if (!companyId) {
      return;
    }
    const payload = event.payload as unknown as UserCreatedPayload;

    try {
      await this.sendNotification.execute({
        companyId,
        kind: 'Alert',
        recipient: { email: payload.email },
        templateId: 'user-welcome',
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar la notification de bienvenida: ${String(error)}`);
    }
  }
}
