import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import { IssueInvoiceHandler, type IssueInvoiceChargeInput } from '@rental/invoices/application';
import type { ChargeKindValue } from '@rental/invoices/domain';

// Forma local del payload de ReservationCheckedIn.v1 - invoices/infrastructure
// (module:invoices) no puede importar @rental/reservations/domain (module:reservations),
// mismo criterio de duplicacion que SecurityDepositHoldListener en Payments.
interface ReservationCheckedInPayload {
  reservationId: string;
  customerId: string;
  priceBreakdown: {
    baseAmountMinorUnits: number;
    currency: string;
    adjustments: { kind: string; amountMinorUnits: number; currency: string; reason?: string }[];
  };
}

// Traduccion ACL (docs/model/01-BOUNDED_CONTEXTS.md SS4.3) - PriceAdjustment.kind (Rental) a
// ChargeKind (Commerce). CancellationPenalty->Penalty es defensiva: en la practica
// inalcanzable via este listener, una Reservation cancelada nunca llega a checkIn() (la
// maquina de estados lo impide), pero se mapea igual por completitud del switch.
const CHARGE_KIND_BY_PRICE_ADJUSTMENT_KIND: Record<string, ChargeKindValue> = {
  Extension: 'Extension',
  LateReturnPenalty: 'Penalty',
  DamagePenalty: 'Damage',
  FuelDifference: 'Fuel',
  CancellationPenalty: 'Penalty',
};

// hold()-equivalente de Invoice: emision automatica, unico disparador real de
// IssueInvoiceHandler (docs/contracts/02-RESOURCE-CATALOG.md SS5 - sin POST /invoices de
// cliente). Fire-and-forget, mismo criterio que SecurityDepositHoldListener/
// SecurityDepositResolveListener.
@Injectable()
export class InvoiceIssuedFromCheckInListener {
  private readonly logger = new Logger(InvoiceIssuedFromCheckInListener.name);

  constructor(private readonly issueInvoice: IssueInvoiceHandler) {}

  @OnEvent('ReservationCheckedIn.v1')
  async handle(event: DomainEventEmitted): Promise<void> {
    const companyId = event.companyId;
    if (!companyId) {
      return;
    }
    const payload = event.payload as unknown as ReservationCheckedInPayload;

    try {
      const charges: IssueInvoiceChargeInput[] = [
        {
          kind: 'RentalFee',
          amountMinorUnits: payload.priceBreakdown.baseAmountMinorUnits,
          currency: payload.priceBreakdown.currency,
          description: 'Renta base',
        },
        ...payload.priceBreakdown.adjustments.map((adjustment) => ({
          kind: CHARGE_KIND_BY_PRICE_ADJUSTMENT_KIND[adjustment.kind] ?? 'Penalty',
          amountMinorUnits: adjustment.amountMinorUnits,
          currency: adjustment.currency,
          description: adjustment.reason ?? adjustment.kind,
        })),
      ];

      await this.issueInvoice.execute({
        companyId,
        reservationId: payload.reservationId,
        customerId: payload.customerId,
        charges,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo emitir la Invoice de la reservation "${payload.reservationId}": ${String(error)}`,
      );
    }
  }
}
