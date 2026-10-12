import { DateRange, Money } from '@platform/shared-kernel';
import {
  FuelLevel,
  Odometer,
  Reservation,
  VehicleNotAvailableError,
} from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { AvailabilityService } from '../../services/availability.service';
import { SwapVehicleHandler } from './swap-vehicle.handler';

function buildCheckedOut(): Reservation {
  const reservation = Reservation.create({
    companyId: 'company-1',
    customerId: 'customer-1',
    vehicleId: 'vehicle-1',
    dateRange: DateRange.from(new Date('2026-09-01T10:00:00Z'), new Date('2026-09-05T10:00:00Z')),
    baseAmount: Money.from(10000, 'USD'),
  });
  reservation.confirm({
    baseAmount: Money.from(10000, 'USD'),
    isCustomerEligible: true,
    areDriversValidated: true,
  });
  reservation.checkOut({
    odometer: Odometer.from(1000),
    fuelLevel: FuelLevel.from(100),
    photoFileIds: [],
    inspectedBy: 'user-1',
    isVehicleOperational: true,
    isBranchActive: true,
    branchId: 'branch-1',
    areDriversValidated: true,
  });
  reservation.pullDomainEvents();
  return reservation;
}

function buildHandler(overrides?: { isNewVehicleAvailable?: boolean }) {
  const reservation = buildCheckedOut();
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const availabilityService = {
    isAvailable: jest.fn().mockResolvedValue(overrides?.isNewVehicleAvailable ?? true),
    reserve: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvailabilityService;
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new SwapVehicleHandler(
    reservationRepository,
    availabilityService,
    unitOfWork as never,
    eventPublisher,
  );

  return { handler, reservation, availabilityService };
}

describe('SwapVehicleHandler', () => {
  it('ocupa el vehicle nuevo ANTES de liberar el viejo (Hallazgo #2: nunca ambos libres)', async () => {
    const { handler, reservation, availabilityService } = buildHandler();
    const callOrder: string[] = [];
    (availabilityService.reserve as jest.Mock).mockImplementation(() => {
      callOrder.push('reserve');
      return Promise.resolve();
    });
    (availabilityService.release as jest.Mock).mockImplementation(() => {
      callOrder.push('release');
      return Promise.resolve();
    });

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      newVehicleId: 'vehicle-2',
      reason: 'averia',
    });

    expect(callOrder).toEqual(['reserve', 'release']);
    expect(reservation.vehicleId).toBe('vehicle-2');
    expect(availabilityService.release).toHaveBeenCalledWith('vehicle-1');
  });

  it('lanza VehicleNotAvailableError si el vehicle nuevo no esta disponible', async () => {
    const { handler, reservation, availabilityService } = buildHandler({
      isNewVehicleAvailable: false,
    });

    await expect(
      handler.execute({
        companyId: 'company-1',
        reservationId: reservation.id.toString(),
        newVehicleId: 'vehicle-2',
      }),
    ).rejects.toThrow(VehicleNotAvailableError);
    expect(availabilityService.reserve).not.toHaveBeenCalled();
  });
});
