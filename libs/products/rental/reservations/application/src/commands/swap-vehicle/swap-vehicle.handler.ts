import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  TRANSACTION_LOCK,
  type TransactionLock,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  BRANCH_LOOKUP_PORT,
  type BranchLookupPort,
  branchLockKey,
} from '@platform/branches/application';
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
import type { SwapVehicleCommand } from './swap-vehicle.command';

// swapVehicle() (docs/domain/07-EXCEPCIONES.md SS7) - "nunca queda un estado intermedio
// donde ambos aparecen ocupados o ambos libres". Desde docs/persistence/10-DECISIONES.md #141,
// ocupar el nuevo, liberar el viejo y guardar la reserva van en una sola transaccion.
@Injectable()
export class SwapVehicleHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    private readonly availabilityService: AvailabilityService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    @Inject(VEHICLE_STATUS_PORT) private readonly vehicleStatusPort: VehicleStatusPort,
    @Inject(BRANCH_LOOKUP_PORT) private readonly branchLookupPort: BranchLookupPort,
    @Inject(TRANSACTION_LOCK) private readonly transactionLock: TransactionLock,
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

    const newBranchId = await this.vehicleStatusPort.getBranchId(command.newVehicleId);
    if (!newBranchId) {
      throw new VehicleNotAvailableError(command.newVehicleId);
    }

    // #141: ocupar el nuevo, liberar el viejo y guardar en una sola transaccion. Locks
    // compartidos de la sucursal y del vehiculo nuevo (en ese orden): un cierre o un
    // mantenimiento no pueden colarse. La sucursal se relee dentro, con el lock tomado.
    await this.unitOfWork.run(async (tx) => {
      await this.transactionLock.acquire(tx, branchLockKey(newBranchId), 'shared');
      await this.transactionLock.acquire(tx, vehicleLockKey(command.newVehicleId), 'shared');
      const branchStatus = await this.branchLookupPort.getStatus(newBranchId, tx);
      reservation.swapVehicle({
        newVehicleId: command.newVehicleId,
        reason: command.reason,
        isNewVehicleAvailable,
        isNewVehicleBranchActive: branchStatus === 'Active',
        newVehicleBranchId: newBranchId,
      });
      await this.availabilityService.reserve(
        reservation.companyId,
        command.newVehicleId,
        reservation.dateRange,
        reservation.id.toString(),
        tx,
      );
      await this.availabilityService.release(previousVehicleId, reservation.id.toString(), tx);
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
