import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { ReservationNotFoundError } from '@rental/reservations/domain';

import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '../../ports/reservation.repository';
import { AvailabilityService } from '../../services/availability.service';
import type { SwapVehicleCommand } from './swap-vehicle.command';

// swapVehicle() (docs/domain/07-EXCEPCIONES.md SS7) - "nunca queda un estado intermedio
// donde ambos aparecen ocupados o ambos libres". Hallazgo #2: ocupa el vehicle nuevo
// primero (distinto resourceId del viejo, sin la ambiguedad de moveOccupancy), libera el
// viejo despues - "ambos ocupados" transitorio es aceptable, "ambos libres" nunca.
@Injectable()
export class SwapVehicleHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    private readonly availabilityService: AvailabilityService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: SwapVehicleCommand): Promise<void> {
    const reservation = await this.reservationRepository.findById(
      EntityId.from(command.reservationId),
    );
    if (!reservation || reservation.companyId !== command.companyId) {
      throw new ReservationNotFoundError(command.reservationId);
    }

    const previousVehicleId = reservation.vehicleId;
    const isNewVehicleAvailable = await this.availabilityService.isAvailable(
      command.newVehicleId,
      reservation.dateRange,
    );

    reservation.swapVehicle({
      newVehicleId: command.newVehicleId,
      reason: command.reason,
      isNewVehicleAvailable,
    });

    await this.availabilityService.reserve(
      reservation.companyId,
      command.newVehicleId,
      reservation.dateRange,
      reservation.id.toString(),
    );
    await this.availabilityService.release(previousVehicleId);

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
