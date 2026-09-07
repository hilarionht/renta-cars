import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { SETTINGS_LOOKUP_PORT, type SettingsLookupPort } from '@platform/settings/application';
import { ReservationNotFoundError } from '@rental/reservations/domain';

import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '../../ports/reservation.repository';
import { AvailabilityService } from '../../services/availability.service';
import { resolveCancellationPenalty } from '../../support/resolve-cancellation-penalty';
import type { CancelReservationCommand } from './cancel-reservation.command';

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

@Injectable()
export class CancelReservationHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    @Inject(SETTINGS_LOOKUP_PORT) private readonly settingsLookupPort: SettingsLookupPort,
    private readonly availabilityService: AvailabilityService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CancelReservationCommand): Promise<void> {
    const reservation = await this.reservationRepository.findById(
      EntityId.from(command.reservationId),
    );
    if (!reservation || reservation.companyId !== command.companyId) {
      throw new ReservationNotFoundError(command.reservationId);
    }

    const wasConfirmed = reservation.status === 'Confirmed';
    let penalty: ReturnType<typeof resolveCancellationPenalty>;
    if (wasConfirmed) {
      const policy = await this.settingsLookupPort.getCancellationPolicy(command.companyId);
      if (policy) {
        const hoursBeforeStart =
          (reservation.dateRange.start.getTime() - Date.now()) / MILLISECONDS_PER_HOUR;
        penalty = resolveCancellationPenalty(policy, hoursBeforeStart, reservation.baseAmount);
      }
    }

    reservation.cancel({
      cancelledBy: command.cancelledBy,
      penalty,
      penaltyReason: 'CancellationPolicy',
    });

    // Draft nunca ocupo el slot (RN-05, Hallazgo #4) - solo se libera si venia Confirmed.
    if (wasConfirmed) {
      await this.availabilityService.release(reservation.vehicleId);
    }

    await this.unitOfWork.run(async (tx) => {
      await this.reservationRepository.save(reservation, tx);
      for (const event of reservation.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Reservation',
          aggregateId: reservation.id.toString(),
          companyId: reservation.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
