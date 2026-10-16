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
import { CUSTOMER_LOOKUP_PORT, type CustomerLookupPort } from '@rental/customers/application';
import {
  VEHICLE_STATUS_PORT,
  type VehicleStatusPort,
  vehicleLockKey,
} from '@rental/vehicles/application';
import {
  CustomerNotEligibleError,
  DriverNotValidatedError,
  ReservationInvalidStateTransitionError,
  ReservationNotFoundError,
  ReservationOverlapError,
  VehicleNotAvailableError,
  type Reservation,
} from '@rental/reservations/domain';

import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '../../ports/reservation.repository';
import { AvailabilityService } from '../../services/availability.service';
import { PricingService } from '../../services/pricing.service';
import type { ConfirmReservationCommand } from './confirm-reservation.command';

// docs/persistence/10-DECISIONES.md #141: ocupar el AvailabilitySlot y guardar la Reservation
// Confirmed van en UNA transaccion (antes eran dos y una compensacion "best-effort" podia dejar
// un slot huerfano). Dentro, con los locks compartidos de la sucursal y del vehiculo tomados (en
// ese orden), se relee si el vehiculo sigue operativo y si la sucursal esta abierta: un
// mantenimiento o un cierre que llego primero se ve aca, y uno que llegue despues espera.
// Si la disponibilidad se pierde (solapamiento en la exclusion GiST o vehiculo que dejo de
// estar operativo), se publica ReservationRejectedByAvailability.v1 en una transaccion propia
// DESPUES del rollback (la del intento quedo abortada); el agregado permanece Draft.
@Injectable()
export class ConfirmReservationHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    @Inject(CUSTOMER_LOOKUP_PORT) private readonly customerLookupPort: CustomerLookupPort,
    @Inject(VEHICLE_STATUS_PORT) private readonly vehicleStatusPort: VehicleStatusPort,
    private readonly availabilityService: AvailabilityService,
    private readonly pricingService: PricingService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    @Inject(BRANCH_LOOKUP_PORT) private readonly branchLookupPort: BranchLookupPort,
    @Inject(TRANSACTION_LOCK) private readonly transactionLock: TransactionLock,
  ) {}

  async execute(command: ConfirmReservationCommand): Promise<void> {
    const reservation = await this.loadReservation(command);

    // Guarda de estado temprana, antes de cualquier I/O de disponibilidad - encontrado via
    // smoke test real: sin esto, un segundo confirm() sobre una Reservation ya Confirmed
    // devolvia VEHICLE_NOT_AVAILABLE (el pre-check de isAvailable() ve el propio slot ya
    // ocupado por esta misma reservation y lo interpreta como "no disponible") en vez de
    // INVALID_STATE_TRANSITION - engañoso para el caller, que no confirmo nada raro sobre
    // el vehicle, sino que la reservation ya no esta en Draft.
    if (reservation.status !== 'Draft') {
      throw new ReservationInvalidStateTransitionError(
        reservation.id.toString(),
        reservation.status,
        'confirm',
      );
    }

    const isCustomerEligible =
      (await this.customerLookupPort.isEligibleForConfirmation(reservation.customerId)) ?? false;
    if (!isCustomerEligible) {
      throw new CustomerNotEligibleError(reservation.customerId);
    }

    const areDriversValidated = await this.customerLookupPort.areAdditionalDriversValidated(
      reservation.authorizedDriverIds,
    );
    if (!areDriversValidated) {
      throw new DriverNotValidatedError(reservation.id.toString());
    }

    const isAvailable = await this.availabilityService.isAvailable(
      reservation.vehicleId,
      reservation.dateRange,
    );
    if (!isAvailable) {
      await this.publishRejection(reservation);
      throw new VehicleNotAvailableError(reservation.vehicleId);
    }

    const categoryId = await this.vehicleStatusPort.getCategoryId(reservation.vehicleId);
    if (!categoryId) {
      throw new VehicleNotAvailableError(reservation.vehicleId);
    }
    const baseAmount = await this.pricingService.calculateBasePrice(
      categoryId,
      reservation.dateRange,
    );

    const branchId = await this.vehicleStatusPort.getBranchId(reservation.vehicleId);
    if (!branchId) {
      throw new VehicleNotAvailableError(reservation.vehicleId);
    }

    let lostAvailability = false;
    try {
      await this.unitOfWork.run(async (tx) => {
        await this.transactionLock.acquire(tx, branchLockKey(branchId), 'shared');
        await this.transactionLock.acquire(tx, vehicleLockKey(reservation.vehicleId), 'shared');

        const isOperational = await this.vehicleStatusPort.isOperational(reservation.vehicleId, tx);
        if (!isOperational) {
          lostAvailability = true;
          throw new VehicleNotAvailableError(reservation.vehicleId);
        }
        const branchStatus = await this.branchLookupPort.getStatus(branchId, tx);

        reservation.confirm({
          baseAmount,
          isCustomerEligible: true,
          areDriversValidated: true,
          isBranchActive: branchStatus === 'Active',
          branchId,
        });
        await this.availabilityService.reserve(
          reservation.companyId,
          reservation.vehicleId,
          reservation.dateRange,
          reservation.id.toString(),
          tx,
        );
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
    } catch (error) {
      if (lostAvailability || error instanceof ReservationOverlapError) {
        await this.publishRejection(reservation);
      }
      throw error;
    }
  }

  private async loadReservation(command: ConfirmReservationCommand): Promise<Reservation> {
    const reservation = await this.reservationRepository.findById(
      EntityId.from(command.reservationId),
    );
    if (!reservation || reservation.companyId !== command.companyId) {
      throw new ReservationNotFoundError(command.reservationId);
    }
    return reservation;
  }

  private async publishRejection(reservation: Reservation): Promise<void> {
    await this.unitOfWork.run(async (tx) => {
      await this.eventPublisher.publish(tx, {
        eventType: 'ReservationRejectedByAvailability.v1',
        aggregateType: 'Reservation',
        aggregateId: reservation.id.toString(),
        companyId: reservation.companyId,
        payload: {
          reservationId: reservation.id.toString(),
          vehicleId: reservation.vehicleId,
          dateRange: {
            startDate: reservation.dateRange.start.toISOString(),
            endDate: reservation.dateRange.end.toISOString(),
          },
        },
      });
    });
  }
}
