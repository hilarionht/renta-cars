import { Inject, Injectable } from '@nestjs/common';

import {
  DateRange,
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  TRANSACTION_LOCK,
  type TransactionLock,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  VEHICLE_STATUS_PORT,
  type VehicleStatusPort,
  vehicleLockKey,
} from '@rental/vehicles/application';
import { ReservationNotFoundError, VehicleNotAvailableError } from '@rental/reservations/domain';

import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '../../ports/reservation.repository';
import { AvailabilityService } from '../../services/availability.service';
import { PricingService } from '../../services/pricing.service';
import type { RescheduleReservationCommand } from './reschedule-reservation.command';

// reschedule() (docs/model/08-STATE_MACHINES.md SS1.2) - valido en Draft/Confirmed. Solo
// una Reservation Confirmed ya ocupa un AvailabilitySlot (Draft nunca lo hizo, Hallazgo #4)
// - solo esa rama mueve la ocupacion (AvailabilityService.moveOccupancy).
@Injectable()
export class RescheduleReservationHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    @Inject(VEHICLE_STATUS_PORT) private readonly vehicleStatusPort: VehicleStatusPort,
    private readonly availabilityService: AvailabilityService,
    private readonly pricingService: PricingService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    @Inject(TRANSACTION_LOCK) private readonly transactionLock: TransactionLock,
  ) {}

  async execute(command: RescheduleReservationCommand): Promise<void> {
    const reservation = await this.reservationRepository.findById(
      EntityId.from(command.reservationId),
    );
    if (!reservation || reservation.companyId !== command.companyId) {
      throw new ReservationNotFoundError(command.reservationId);
    }

    const wasConfirmed = reservation.status === 'Confirmed';
    const newRange = DateRange.from(command.newStartDate, command.newEndDate);
    const categoryId = await this.vehicleStatusPort.getCategoryId(reservation.vehicleId);
    if (!categoryId) {
      throw new VehicleNotAvailableError(reservation.vehicleId);
    }
    const isNewRangeAvailable = await this.availabilityService.isAvailable(
      reservation.vehicleId,
      newRange,
      reservation.id.toString(),
    );
    const newBaseAmount = await this.pricingService.calculateBasePrice(categoryId, newRange);

    reservation.reschedule({ newRange, newBaseAmount, isNewRangeAvailable });

    await this.unitOfWork.run(async (tx) => {
      // #141: mover la ocupacion y guardar en la misma transaccion, con el lock compartido del
      // vehiculo (un mantenimiento no puede colarse entre su chequeo y este movimiento).
      if (wasConfirmed) {
        await this.transactionLock.acquire(tx, vehicleLockKey(reservation.vehicleId), 'shared');
        await this.availabilityService.moveOccupancy(
          reservation.companyId,
          reservation.vehicleId,
          newRange,
          reservation.id.toString(),
          tx,
        );
      }
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
