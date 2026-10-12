import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import { CloseReservationHandler } from '@rental/reservations/application';

// Forma local del payload de InvoiceIssued.v1 - reservations/infrastructure (scope:product-
// rental, module:reservations) no puede importar @rental/invoices/domain (module:invoices),
// asi que se duplica el subconjunto de campos que este listener necesita, documentado contra
// docs/model/06-DOMAIN_EVENTS.md SS6.4 - mismo criterio de duplicacion ya usado para VOs/
// eventos cross-modulo en Payments (SecurityDepositHoldListener).
interface InvoiceIssuedPayload {
  reservationId: string;
}

// close() nunca fue un endpoint HTTP documentado (docs/contracts/02-RESOURCE-CATALOG.md SS4
// no lo lista) - el placeholder de Fase 1 que confiaba en un hasInvoiceIssued autodeclarado
// por el cliente (docs/persistence/10-DECISIONES.md #69/#79) se reemplaza por este listener,
// unico disparador real de CloseReservationHandler ahora que Invoice existe de verdad
// (INV-108/RN-22). Fire-and-forget (OutboxWriter usa EventEmitter2.emit(), nunca
// emitAsync()): un fallo aca nunca debe propagarse, mismo criterio que
// SecurityDepositHoldListener/SecurityDepositResolveListener.
@Injectable()
export class InvoiceIssuedListener {
  private readonly logger = new Logger(InvoiceIssuedListener.name);

  constructor(private readonly closeReservation: CloseReservationHandler) {}

  @OnEvent('InvoiceIssued.v1')
  async handle(event: DomainEventEmitted): Promise<void> {
    const companyId = event.companyId;
    if (!companyId) {
      return;
    }
    const payload = event.payload as unknown as InvoiceIssuedPayload;

    try {
      await this.closeReservation.execute({
        companyId,
        reservationId: payload.reservationId,
        hasInvoiceIssued: true,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo cerrar la reservation "${payload.reservationId}" tras InvoiceIssued.v1: ${String(error)}`,
      );
    }
  }
}
