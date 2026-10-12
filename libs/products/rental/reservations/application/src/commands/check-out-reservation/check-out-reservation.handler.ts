import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { BRANCH_LOOKUP_PORT, type BranchLookupPort } from '@platform/branches/application';
import { CUSTOMER_LOOKUP_PORT, type CustomerLookupPort } from '@rental/customers/application';
import { VEHICLE_STATUS_PORT, type VehicleStatusPort } from '@rental/vehicles/application';
import {
  FuelLevel,
  Odometer,
  ReservationNotFoundError,
  VehicleNotAvailableError,
} from '@rental/reservations/domain';

import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '../../ports/reservation.repository';
import type { CheckOutReservationCommand } from './check-out-reservation.command';

// checkOut() (docs/model/08-STATE_MACHINES.md SS1.1) - INV-103 (Vehicle operational),
// INV-112 (Branch activa), INV-105 (drivers Validated), RN-13 (Inspection completa).
@Injectable()
export class CheckOutReservationHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    @Inject(VEHICLE_STATUS_PORT) private readonly vehicleStatusPort: VehicleStatusPort,
    @Inject(BRANCH_LOOKUP_PORT) private readonly branchLookupPort: BranchLookupPort,
    @Inject(CUSTOMER_LOOKUP_PORT) private readonly customerLookupPort: CustomerLookupPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CheckOutReservationCommand): Promise<void> {
    const reservation = await this.reservationRepository.findById(
      EntityId.from(command.reservationId),
    );
    if (!reservation || reservation.companyId !== command.companyId) {
      throw new ReservationNotFoundError(command.reservationId);
    }

    const branchId = await this.vehicleStatusPort.getBranchId(reservation.vehicleId);
    if (!branchId) {
      throw new VehicleNotAvailableError(reservation.vehicleId);
    }
    const [isVehicleOperational, branchStatus, areDriversValidated] = await Promise.all([
      this.vehicleStatusPort.isOperational(reservation.vehicleId),
      this.branchLookupPort.getStatus(branchId),
      this.customerLookupPort.areAdditionalDriversValidated(reservation.authorizedDriverIds),
    ]);

    reservation.checkOut({
      odometer: Odometer.from(command.odometer),
      fuelLevel: FuelLevel.from(command.fuelLevelPercentage),
      photoFileIds: command.photoFileIds,
      inspectedBy: command.inspectedBy,
      isVehicleOperational: isVehicleOperational ?? false,
      isBranchActive: branchStatus === 'Active',
      branchId,
      areDriversValidated,
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
  }
}
