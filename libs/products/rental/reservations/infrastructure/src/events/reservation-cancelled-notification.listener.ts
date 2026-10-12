import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import { SendNotificationHandler } from '@platform/notifications/application';
import { CUSTOMER_LOOKUP_PORT, type CustomerLookupPort } from '@rental/customers/application';

// Forma local del payload de ReservationCancelled.v1 - mismo criterio de duplicacion que
// ReservationConfirmedNotificationListener (este mismo modulo) - nunca importa
// @rental/reservations/domain.
interface ReservationCancelledPayload {
  reservationId: string;
  customerId: string;
  cancelledBy: string;
  penaltyApplied?: { kind: string; amountMinorUnits: number; currency: string; reason?: string };
}

// docs/persistence/10-DECISIONES.md #117 (mitad "cancelacion" del gap diferido en #98) - RN-32
// exige notificar la cancelacion de una Reservation al Customer. Vive aca (no en
// notifications/infrastructure) por el mismo motivo que ReservationConfirmedNotificationListener
// - boundaries.mjs bloquea a Notifications (scope:platform) de alcanzar Customers
// (scope:product-rental). Fire-and-forget (OutboxWriter usa EventEmitter2.emit(), nunca
// emitAsync()): un fallo aca nunca debe propagar ni afectar el cancel() que ya commiteo, mismo
// criterio que el resto de listeners de notificacion de este modulo.
@Injectable()
export class ReservationCancelledNotificationListener {
  private readonly logger = new Logger(ReservationCancelledNotificationListener.name);

  constructor(
    @Inject(CUSTOMER_LOOKUP_PORT) private readonly customerLookupPort: CustomerLookupPort,
    private readonly sendNotification: SendNotificationHandler,
  ) {}

  @OnEvent('ReservationCancelled.v1')
  async handle(event: DomainEventEmitted): Promise<void> {
    const companyId = event.companyId;
    if (!companyId) {
      return;
    }
    const payload = event.payload as unknown as ReservationCancelledPayload;

    try {
      const contact = await this.customerLookupPort.getContactInfo(payload.customerId, companyId);
      if (!contact) {
        this.logger.error(
          `No se encontro el customer "${payload.customerId}" para notificar la cancelacion de la reservation "${payload.reservationId}".`,
        );
        return;
      }

      await this.sendNotification.execute({
        companyId,
        kind: 'Cancellation',
        recipient: { email: contact.email, phone: contact.phone },
        templateId: 'reservation-cancelled',
        templateParams: {
          customerName: contact.name,
          reservationId: payload.reservationId,
          // templateParams es Record<string, string> (send-notification.command.ts) - sin
          // penalidad, la clave se omite en vez de mandar 'undefined' como texto literal.
          ...(payload.penaltyApplied
            ? { penaltyApplied: JSON.stringify(payload.penaltyApplied) }
            : {}),
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo notificar la cancelacion de la reservation "${payload.reservationId}": ${String(error)}`,
      );
    }
  }
}
