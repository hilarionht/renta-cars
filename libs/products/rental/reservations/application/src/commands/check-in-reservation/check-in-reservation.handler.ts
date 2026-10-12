import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  Money,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { BRANCH_LOOKUP_PORT, type BranchLookupPort } from '@platform/branches/application';
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
import { AvailabilityService } from '../../services/availability.service';
import { PricingService } from '../../services/pricing.service';
import type { CheckInReservationCommand } from './check-in-reservation.command';

// checkIn() - INV-112 (Branch activa), INV-004/RN-14 (Inspection comparada contra
// CheckOut), RN-15/RN-16 (penalidad por devolucion tardia con tolerancia de gracia),
// RN-18 (diferencia de combustible), RN-17 (dano detectado). Tambien libera el
// AvailabilitySlot (Hallazgo #5 del plan de implementacion - decision propia, no textual:
// permite re-reservar el Vehicle de inmediato si la devolucion es anticipada, ya que
// AvailabilitySlot no tiene mecanismo de expiracion automatica).
@Injectable()
export class CheckInReservationHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    @Inject(VEHICLE_STATUS_PORT) private readonly vehicleStatusPort: VehicleStatusPort,
    @Inject(BRANCH_LOOKUP_PORT) private readonly branchLookupPort: BranchLookupPort,
    private readonly pricingService: PricingService,
    private readonly availabilityService: AvailabilityService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CheckInReservationCommand): Promise<void> {
    const reservation = await this.reservationRepository.findById(
      EntityId.from(command.reservationId),
    );
    if (!reservation || reservation.companyId !== command.companyId) {
      throw new ReservationNotFoundError(command.reservationId);
    }

    const [branchId, categoryId] = await Promise.all([
      this.vehicleStatusPort.getBranchId(reservation.vehicleId),
      this.vehicleStatusPort.getCategoryId(reservation.vehicleId),
    ]);
    if (!branchId || !categoryId) {
      throw new VehicleNotAvailableError(reservation.vehicleId);
    }
    const branchStatus = await this.branchLookupPort.getStatus(branchId);

    const dailyRate = await this.pricingService.getDailyRate(categoryId);
    const lateReturnPolicy = await this.pricingService.getLateReturnPolicy(command.companyId);
    const lateReturnPenalty = this.pricingService.calculateLateReturnPenalty(
      new Date(),
      reservation.dateRange.end,
      lateReturnPolicy,
      dailyRate,
    );

    const checkOutInspection = reservation.allInspections.find(
      (inspection) => inspection.type === 'CheckOut',
    );
    const fuelDifferenceCharge = checkOutInspection
      ? this.pricingService.calculateFuelDifferenceCharge(
          checkOutInspection.fuelLevel.value,
          command.fuelLevelPercentage,
          dailyRate,
        )
      : Money.from(0, dailyRate.currencyCode);

    const adjustments: {
      amount: Money;
      kind: 'LateReturnPenalty' | 'DamagePenalty' | 'FuelDifference';
      reason?: string;
    }[] = [];
    if (lateReturnPenalty.minorUnits > 0) {
      adjustments.push({ amount: lateReturnPenalty, kind: 'LateReturnPenalty' });
    }
    if (fuelDifferenceCharge.minorUnits > 0) {
      adjustments.push({ amount: fuelDifferenceCharge, kind: 'FuelDifference' });
    }
    for (const damage of command.damages ?? []) {
      if (damage.penaltyAmountMinorUnits && damage.penaltyAmountMinorUnits > 0) {
        adjustments.push({
          amount: Money.from(damage.penaltyAmountMinorUnits, dailyRate.currencyCode),
          kind: 'DamagePenalty',
          reason: damage.description,
        });
      }
    }

    reservation.checkIn({
      odometer: Odometer.from(command.odometer),
      fuelLevel: FuelLevel.from(command.fuelLevelPercentage),
      photoFileIds: command.photoFileIds,
      inspectedBy: command.inspectedBy,
      isBranchActive: branchStatus === 'Active',
      branchId,
      damages: command.damages?.map((damage) => ({
        description: damage.description,
        severity: damage.severity,
        imputableToCustomer: damage.imputableToCustomer,
        photoFileIds: damage.photoFileIds,
      })),
      adjustments,
    });

    await this.availabilityService.release(reservation.vehicleId);

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
