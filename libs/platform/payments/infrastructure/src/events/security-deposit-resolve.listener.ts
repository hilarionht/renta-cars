import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { DomainEventEmitted } from '@platform/shared-kernel';
import {
  ReleaseSecurityDepositHandler,
  RetainSecurityDepositHandler,
  SECURITY_DEPOSIT_REPOSITORY,
  type SecurityDepositRepository,
} from '@platform/payments/application';

// Forma local del payload de ReservationCheckedIn.v1 - mismo criterio de duplicacion que
// SecurityDepositHoldListener (payments/infrastructure no puede importar
// @rental/reservations/domain). docs/model/06-DOMAIN_EVENTS.md SS6.3: sin customerId (gap
// documentado, no bloquea este listener).
interface ReservationCheckedInPayload {
  reservationId: string;
  priceBreakdown: {
    adjustments: { kind: string; amountMinorUnits: number; reason?: string }[];
  };
}

// release()/retain() automaticos - reaccion a ReservationCheckedIn.v1 (retiene si hay algun
// PriceAdjustment de tipo DamagePenalty, libera si no). Fire-and-forget, mismo criterio que
// SecurityDepositHoldListener. No-op silencioso si no hay ningun SecurityDeposit Held para la
// reserva - nunca se retuvo (DepositPolicy.applies=false en confirm()).
@Injectable()
export class SecurityDepositResolveListener {
  private readonly logger = new Logger(SecurityDepositResolveListener.name);

  constructor(
    @Inject(SECURITY_DEPOSIT_REPOSITORY)
    private readonly securityDepositRepository: SecurityDepositRepository,
    private readonly releaseSecurityDeposit: ReleaseSecurityDepositHandler,
    private readonly retainSecurityDeposit: RetainSecurityDepositHandler,
  ) {}

  @OnEvent('ReservationCheckedIn.v1')
  async handle(event: DomainEventEmitted): Promise<void> {
    const companyId = event.companyId;
    if (!companyId) {
      return;
    }
    const payload = event.payload as unknown as ReservationCheckedInPayload;

    try {
      const deposit = await this.securityDepositRepository.findByReservationId(
        payload.reservationId,
        companyId,
      );
      if (!deposit) {
        return;
      }

      const damagePenalties = payload.priceBreakdown.adjustments.filter(
        (adjustment) => adjustment.kind === 'DamagePenalty',
      );
      if (damagePenalties.length === 0) {
        await this.releaseSecurityDeposit.execute({
          companyId,
          securityDepositId: deposit.id.toString(),
        });
        return;
      }

      const retainedAmountMinorUnits = Math.min(
        damagePenalties.reduce((sum, adjustment) => sum + adjustment.amountMinorUnits, 0),
        deposit.amount.minorUnits,
      );
      const reason =
        damagePenalties
          .map((adjustment) => adjustment.reason)
          .filter((reason): reason is string => Boolean(reason))
          .join('; ') || 'Danos reportados en el check-in';

      await this.retainSecurityDeposit.execute({
        companyId,
        securityDepositId: deposit.id.toString(),
        retainedAmountMinorUnits,
        currency: deposit.amount.currencyCode,
        reason,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo resolver el SecurityDeposit de la reservation "${payload.reservationId}": ${String(error)}`,
      );
    }
  }
}
