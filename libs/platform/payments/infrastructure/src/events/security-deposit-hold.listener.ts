import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import { SETTINGS_LOOKUP_PORT, type SettingsLookupPort } from '@platform/settings/application';
import { HoldSecurityDepositHandler } from '@platform/payments/application';

// Forma local del payload de ReservationConfirmed.v1 - payments/infrastructure (scope:platform)
// no puede importar @rental/reservations/domain (scope:product-rental, tooling/eslint/
// boundaries.mjs), asi que se duplica el subconjunto de campos que este listener necesita,
// documentado contra docs/model/06-DOMAIN_EVENTS.md SS6.2 - mismo criterio de duplicacion ya
// usado para VOs cross-modulo (PaymentMethod).
interface ReservationConfirmedPayload {
  reservationId: string;
  priceBreakdown: { baseAmountMinorUnits: number; currency: string };
}

// hold() nunca es un endpoint HTTP - disparado unicamente por ReservationConfirmed.v1
// (docs/contracts/02-RESOURCE-CATALOG.md SS5). Fire-and-forget (OutboxWriter usa
// EventEmitter2.emit(), nunca emitAsync()): un fallo aca nunca debe propagarse ni abortar el
// confirm() que ya commiteo, mismo criterio que DomainEventAuditListener.
@Injectable()
export class SecurityDepositHoldListener {
  private readonly logger = new Logger(SecurityDepositHoldListener.name);

  constructor(
    private readonly holdSecurityDeposit: HoldSecurityDepositHandler,
    @Inject(SETTINGS_LOOKUP_PORT) private readonly settingsLookupPort: SettingsLookupPort,
  ) {}

  @OnEvent('ReservationConfirmed.v1')
  async handle(event: DomainEventEmitted): Promise<void> {
    const companyId = event.companyId;
    if (!companyId) {
      return;
    }
    const payload = event.payload as unknown as ReservationConfirmedPayload;

    try {
      const policy = await this.settingsLookupPort.getDepositPolicy(companyId);
      if (!policy?.applies) {
        return;
      }

      const amountMinorUnits = Math.round(
        (payload.priceBreakdown.baseAmountMinorUnits * policy.percentageOfTotal) / 100,
      );
      if (amountMinorUnits <= 0) {
        return;
      }

      await this.holdSecurityDeposit.execute({
        companyId,
        reservationId: payload.reservationId,
        amountMinorUnits,
        currency: payload.priceBreakdown.currency,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo retener el SecurityDeposit de la reservation "${payload.reservationId}": ${String(error)}`,
      );
    }
  }
}
