import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { CUSTOMER_LOOKUP_PORT, type CustomerLookupPort } from '@rental/customers/application';
import { VEHICLE_STATUS_PORT, type VehicleStatusPort } from '@rental/vehicles/application';
import {
  CustomerNotEligibleError,
  DriverNotValidatedError,
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

// Hallazgo #3 del plan de implementacion: confirm() ocupa el AvailabilitySlot ANTES de
// persistir Reservation -> Confirmed. Si la disponibilidad se pierde entre el pre-check
// (isAvailable) y el occupy() real (carrera con otra confirmacion concurrente), se publica
// ReservationRejectedByAvailability.v1 SIN tocar el agregado (permanece Draft, no existe
// estado "Rejected" en la maquina de estados) - el evento se publica en su propia
// transaccion, independiente de la del agregado (OutboxWriter.publish() no exige que la
// fila del agregado cambie en el mismo `tx`).
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
  ) {}

  async execute(command: ConfirmReservationCommand): Promise<void> {
    const reservation = await this.loadReservation(command);

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

    try {
      await this.availabilityService.reserve(
        reservation.companyId,
        reservation.vehicleId,
        reservation.dateRange,
        reservation.id.toString(),
      );
    } catch (error) {
      if (error instanceof ReservationOverlapError) {
        await this.publishRejection(reservation);
      }
      throw error;
    }

    reservation.confirm({ baseAmount, isCustomerEligible: true, areDriversValidated: true });

    try {
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
    } catch (error) {
      // Compensacion best-effort (Hallazgo #2/#3): el slot ya quedo Active pero la
      // persistencia de Reservation fallo (p. ej. ConcurrentModificationError) - liberar
      // para no dejar una ocupacion huerfana. Un fallo de la compensacion misma es un gap
      // conocido de reconciliacion, no bloqueante para Fase 1 (ver plan de implementacion).
      await this.availabilityService.release(reservation.vehicleId).catch(() => undefined);
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
