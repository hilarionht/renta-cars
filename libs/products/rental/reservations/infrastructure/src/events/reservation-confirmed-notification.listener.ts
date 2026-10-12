import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import { SendNotificationHandler } from '@platform/notifications/application';
import { CUSTOMER_LOOKUP_PORT, type CustomerLookupPort } from '@rental/customers/application';

// Forma local del payload de ReservationConfirmed.v1 - mismo criterio de duplicacion que
// InvoiceIssuedListener (este mismo modulo) - nunca importa @rental/reservations/domain.
interface ReservationConfirmedPayload {
  reservationId: string;
  customerId: string;
  dateRange: { startDate: string; endDate: string };
}

// docs/persistence/10-DECISIONES.md #98 (Fase 3 item 3) - RN-32 exige notificar la
// confirmacion de una Reservation al Customer. Vive aca (no en notifications/infrastructure)
// porque boundaries.mjs bloquea a Notifications (scope:platform) de alcanzar Customers
// (scope:product-rental) en cualquier capa - la resolucion de email/telefono solo puede
// ocurrir de este lado. Fire-and-forget (OutboxWriter usa EventEmitter2.emit(), nunca
// emitAsync()): un fallo aca nunca debe propagar ni afectar el confirm() que ya commiteo,
// mismo criterio que InvoiceIssuedListener/SecurityDepositHoldListener. companyId pasado
// explicito a getContactInfo() - este listener corre detached de cualquier RequestContext.
@Injectable()
export class ReservationConfirmedNotificationListener {
  private readonly logger = new Logger(ReservationConfirmedNotificationListener.name);

  constructor(
    @Inject(CUSTOMER_LOOKUP_PORT) private readonly customerLookupPort: CustomerLookupPort,
    private readonly sendNotification: SendNotificationHandler,
  ) {}

  @OnEvent('ReservationConfirmed.v1')
  async handle(event: DomainEventEmitted): Promise<void> {
    const companyId = event.companyId;
    if (!companyId) {
      return;
    }
    const payload = event.payload as unknown as ReservationConfirmedPayload;

    try {
      const contact = await this.customerLookupPort.getContactInfo(payload.customerId, companyId);
      if (!contact) {
        this.logger.error(
          `No se encontro el customer "${payload.customerId}" para notificar la confirmacion de la reservation "${payload.reservationId}".`,
        );
        return;
      }

      await this.sendNotification.execute({
        companyId,
        kind: 'Confirmation',
        recipient: { email: contact.email, phone: contact.phone },
        templateId: 'reservation-confirmed',
        templateParams: {
          customerName: contact.name,
          reservationId: payload.reservationId,
          checkOutDate: payload.dateRange.startDate,
          checkInDate: payload.dateRange.endDate,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo notificar la confirmacion de la reservation "${payload.reservationId}": ${String(error)}`,
      );
    }
  }
}
