import { Inject, Injectable } from '@nestjs/common';

import {
  DateRange,
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  Money,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { VEHICLE_STATUS_PORT, type VehicleStatusPort } from '@rental/vehicles/application';
import { ReservationNotFoundError, VehicleNotAvailableError } from '@rental/reservations/domain';

import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '../../ports/reservation.repository';
import { AvailabilityService } from '../../services/availability.service';
import { PricingService } from '../../services/pricing.service';
import type { ApproveExtensionCommand } from './approve-extension.command';

// approveExtension() - INV-106/RN-30: si el rango extendido colisiona con otra Reservation
// confirmada, exige swapVehicle() o rechazo explicito (ExtensionCollidesError), nunca una
// aprobacion implicita.
@Injectable()
export class ApproveExtensionHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    @Inject(VEHICLE_STATUS_PORT) private readonly vehicleStatusPort: VehicleStatusPort,
    private readonly availabilityService: AvailabilityService,
    private readonly pricingService: PricingService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ApproveExtensionCommand): Promise<void> {
    const reservation = await this.reservationRepository.findById(
      EntityId.from(command.reservationId),
    );
    if (!reservation || reservation.companyId !== command.companyId) {
      throw new ReservationNotFoundError(command.reservationId);
    }

    const categoryId = await this.vehicleStatusPort.getCategoryId(reservation.vehicleId);
    if (!categoryId) {
      throw new VehicleNotAvailableError(reservation.vehicleId);
    }
    const newRange = DateRange.from(reservation.dateRange.start, command.newEndDate);
    const isNewRangeAvailable = await this.availabilityService.isAvailable(
      reservation.vehicleId,
      newRange,
    );
    const newTotal = await this.pricingService.recalculateForExtension(categoryId, newRange);
    const adjustmentAmount = Money.from(
      Math.max(0, newTotal.minorUnits - reservation.baseAmount.minorUnits),
      newTotal.currencyCode,
    );

    reservation.approveExtension({
      newEndDate: command.newEndDate,
      adjustmentAmount,
      isNewRangeAvailable,
    });

    await this.availabilityService.moveOccupancy(
      reservation.companyId,
      reservation.vehicleId,
      newRange,
      reservation.id.toString(),
    );

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
