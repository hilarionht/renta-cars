import { Inject, Injectable } from '@nestjs/common';

import {
  DateRange,
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { VEHICLE_STATUS_PORT, type VehicleStatusPort } from '@rental/vehicles/application';
import {
  Reservation,
  VehicleNotAvailableError,
  type ReservationId,
} from '@rental/reservations/domain';

import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '../../ports/reservation.repository';
import { PricingService } from '../../services/pricing.service';
import type { CreateReservationCommand } from './create-reservation.command';

@Injectable()
export class CreateReservationHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    @Inject(VEHICLE_STATUS_PORT) private readonly vehicleStatusPort: VehicleStatusPort,
    private readonly pricingService: PricingService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateReservationCommand): Promise<ReservationId> {
    const categoryId = await this.vehicleStatusPort.getCategoryId(command.vehicleId);
    if (!categoryId) {
      throw new VehicleNotAvailableError(command.vehicleId);
    }

    const dateRange = DateRange.from(command.startDate, command.endDate);
    const baseAmount = await this.pricingService.calculateBasePrice(categoryId, dateRange);

    const reservation = Reservation.create({
      companyId: command.companyId,
      customerId: command.customerId,
      vehicleId: command.vehicleId,
      dateRange,
      baseAmount,
      authorizedDriverIds: command.authorizedDriverIds,
    });

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

    return reservation.id;
  }
}
