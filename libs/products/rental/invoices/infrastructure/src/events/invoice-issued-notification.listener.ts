import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import { SendNotificationHandler } from '@platform/notifications/application';
import { CUSTOMER_LOOKUP_PORT, type CustomerLookupPort } from '@rental/customers/application';

// Forma local del payload de InvoiceIssued.v1 - mismo criterio de duplicacion que
// InvoiceIssuedFromCheckInListener (este mismo modulo) - nunca importa
// @rental/invoices/domain.
interface InvoiceIssuedPayload {
  invoiceId: string;
  customerId: string;
  invoiceNumber: string;
  total: { minorUnits: number; currency: string };
}

// docs/persistence/10-DECISIONES.md #98 (Fase 3 item 3) - RN-32 exige notificar el
// comprobante de pago al Customer. Vive aca (no en notifications/infrastructure) porque
// boundaries.mjs bloquea a Notifications (scope:platform) de alcanzar Customers
// (scope:product-rental) en cualquier capa - la resolucion de email/telefono solo puede
// ocurrir de este lado. Fire-and-forget (OutboxWriter usa EventEmitter2.emit(), nunca
// emitAsync()): un fallo aca nunca debe propagar ni afectar el issue() que ya commiteo,
// mismo criterio que ReservationConfirmedNotificationListener/InvoiceIssuedFromCheckInListener.
@Injectable()
export class InvoiceIssuedNotificationListener {
  private readonly logger = new Logger(InvoiceIssuedNotificationListener.name);

  constructor(
    @Inject(CUSTOMER_LOOKUP_PORT) private readonly customerLookupPort: CustomerLookupPort,
    private readonly sendNotification: SendNotificationHandler,
  ) {}

  @OnEvent('InvoiceIssued.v1')
  async handle(event: DomainEventEmitted): Promise<void> {
    const companyId = event.companyId;
    if (!companyId) {
      return;
    }
    const payload = event.payload as unknown as InvoiceIssuedPayload;

    try {
      const contact = await this.customerLookupPort.getContactInfo(payload.customerId, companyId);
      if (!contact) {
        this.logger.error(
          `No se encontro el customer "${payload.customerId}" para notificar el comprobante de la invoice "${payload.invoiceId}".`,
        );
        return;
      }

      await this.sendNotification.execute({
        companyId,
        kind: 'Receipt',
        recipient: { email: contact.email, phone: contact.phone },
        templateId: 'invoice-receipt',
        templateParams: {
          customerName: contact.name,
          invoiceNumber: payload.invoiceNumber,
          totalAmount: String(payload.total.minorUnits),
          currency: payload.total.currency,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo notificar el comprobante de la invoice "${payload.invoiceId}": ${String(error)}`,
      );
    }
  }
}
