import type { CalendarPort } from '@platform/calendar/application';
import { DateRange } from '@platform/shared-kernel';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import { ReservationOverlapError } from '@rental/reservations/domain';

import { AvailabilityService } from './availability.service';

function range(): DateRange {
  return DateRange.from(new Date('2026-09-01T10:00:00Z'), new Date('2026-09-05T10:00:00Z'));
}

describe('AvailabilityService', () => {
  describe('isAvailable', () => {
    it('retorna false si el vehicle no es operational, sin consultar CalendarPort (RN-04)', async () => {
      const vehicleStatusPort: VehicleStatusPort = {
        isOperational: jest.fn().mockResolvedValue(false),
        getBranchId: jest.fn(),
        getCategoryId: jest.fn(),
      };
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn(),
        release: jest.fn(),
        move: jest.fn(),
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
      };
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      const result = await service.isAvailable('vehicle-1', range());

      expect(result).toBe(false);
      expect(calendarPort.isAvailable).not.toHaveBeenCalled();
    });

    it('delega en CalendarPort.isAvailable() si el vehicle es operational', async () => {
      const vehicleStatusPort: VehicleStatusPort = {
        isOperational: jest.fn().mockResolvedValue(true),
        getBranchId: jest.fn(),
        getCategoryId: jest.fn(),
      };
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn().mockResolvedValue(true),
        occupy: jest.fn(),
        release: jest.fn(),
        move: jest.fn(),
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
      };
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      const result = await service.isAvailable('vehicle-1', range());

      expect(result).toBe(true);
      expect(calendarPort.isAvailable).toHaveBeenCalledWith(
        'vehicle',
        'vehicle-1',
        range().start,
        range().end,
        undefined,
      );
    });

    // docs/persistence/10-DECISIONES.md #136: al reprogramar/extender, la propia reserva no cuenta.
    it('pasa la reserva a excluir a CalendarPort.isAvailable()', async () => {
      const vehicleStatusPort: VehicleStatusPort = {
        isOperational: jest.fn().mockResolvedValue(true),
        getBranchId: jest.fn(),
        getCategoryId: jest.fn(),
      };
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn().mockResolvedValue(true),
        occupy: jest.fn(),
        release: jest.fn(),
        move: jest.fn(),
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
      };
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await service.isAvailable('vehicle-1', range(), 'reservation-1');

      expect(calendarPort.isAvailable).toHaveBeenCalledWith(
        'vehicle',
        'vehicle-1',
        range().start,
        range().end,
        'reservation-1',
      );
    });
  });

  describe('reserve', () => {
    it('traduce AvailabilitySlotOverlapError (por .name, sin importar la clase) a ReservationOverlapError', async () => {
      const overlapError = new Error('slot overlap');
      overlapError.name = 'AvailabilitySlotOverlapError';
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn().mockRejectedValue(overlapError),
        release: jest.fn(),
        move: jest.fn(),
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await expect(
        service.reserve('company-1', 'vehicle-1', range(), 'reservation-1'),
      ).rejects.toThrow(ReservationOverlapError);
    });

    it('propaga cualquier otro error sin traducir', async () => {
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn().mockRejectedValue(new Error('infra failure')),
        release: jest.fn(),
        move: jest.fn(),
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await expect(
        service.reserve('company-1', 'vehicle-1', range(), 'reservation-1'),
      ).rejects.toThrow('infra failure');
    });
  });

  describe('release', () => {
    it('es no-op si no hay ningun slot Active', async () => {
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn(),
        release: jest.fn(),
        move: jest.fn(),
        findActiveSlotId: jest.fn().mockResolvedValue(null),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await service.release('vehicle-1', 'reservation-1');

      expect(calendarPort.release).not.toHaveBeenCalled();
    });

    it('libera el slot activo encontrado', async () => {
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn(),
        release: jest.fn().mockResolvedValue(undefined),
        move: jest.fn(),
        findActiveSlotId: jest.fn().mockResolvedValue('slot-1'),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await service.release('vehicle-1', 'reservation-1');

      expect(calendarPort.findActiveSlotId).toHaveBeenCalledWith(
        'vehicle',
        'vehicle-1',
        'reservation-1',
        undefined,
      );
      expect(calendarPort.release).toHaveBeenCalledWith('slot-1', undefined);
    });

    // Regresion de docs/persistence/10-DECISIONES.md #132: con dos reservas futuras del mismo
    // vehiculo hay dos slots Active - liberar la reserva A nunca debe liberar el slot de B.
    it('con dos reservas del mismo vehiculo, libera solo el slot de la reserva indicada', async () => {
      const activeSlots = [
        { id: 'slot-reserva-b', resourceId: 'vehicle-1', referenceId: 'reservation-b' },
        { id: 'slot-reserva-a', resourceId: 'vehicle-1', referenceId: 'reservation-a' },
      ];
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn(),
        release: jest.fn().mockResolvedValue(undefined),
        move: jest.fn(),
        findActiveSlotId: jest.fn((_type: string, resourceId: string, referenceId: string) =>
          Promise.resolve(
            activeSlots.find(
              (slot) => slot.resourceId === resourceId && slot.referenceId === referenceId,
            )?.id ?? null,
          ),
        ),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await service.release('vehicle-1', 'reservation-a');

      expect(calendarPort.release).toHaveBeenCalledTimes(1);
      expect(calendarPort.release).toHaveBeenCalledWith('slot-reserva-a', undefined);
    });
  });

  // docs/persistence/10-DECISIONES.md #136: mover = CalendarPort.move() (libera y ocupa en una
  // sola transaccion). Antes se ocupaba el nuevo antes de liberar el viejo y la exclusion GiST
  // rechazaba cualquier rango superpuesto al actual.
  describe('moveOccupancy', () => {
    function calendarPortWith(overrides: Partial<CalendarPort>): CalendarPort {
      return {
        isAvailable: jest.fn(),
        occupy: jest.fn().mockResolvedValue('new-slot-id'),
        release: jest.fn(),
        move: jest.fn().mockResolvedValue('new-slot-id'),
        findActiveSlotId: jest.fn().mockResolvedValue('old-slot-id'),
        findOccupiedResourceIds: jest.fn(),
        findActiveBookings: jest.fn(),
        ...overrides,
      };
    }

    it('con slot activo de la reserva, lo mueve en una sola operacion (sin occupy/release sueltos)', async () => {
      const calendarPort = calendarPortWith({});
      const service = new AvailabilityService({} as VehicleStatusPort, calendarPort);

      await service.moveOccupancy('company-1', 'vehicle-1', range(), 'reservation-1');

      expect(calendarPort.findActiveSlotId).toHaveBeenCalledWith(
        'vehicle',
        'vehicle-1',
        'reservation-1',
        undefined,
      );
      expect(calendarPort.move).toHaveBeenCalledWith(
        'old-slot-id',
        range().start,
        range().end,
        undefined,
      );
      expect(calendarPort.occupy).not.toHaveBeenCalled();
      expect(calendarPort.release).not.toHaveBeenCalled();
    });

    it('si el rango nuevo choca con otra reserva, lanza ReservationOverlapError', async () => {
      const overlap = new Error('solapa');
      overlap.name = 'AvailabilitySlotOverlapError';
      const calendarPort = calendarPortWith({ move: jest.fn().mockRejectedValue(overlap) });
      const service = new AvailabilityService({} as VehicleStatusPort, calendarPort);

      await expect(
        service.moveOccupancy('company-1', 'vehicle-1', range(), 'reservation-1'),
      ).rejects.toThrow(ReservationOverlapError);
    });

    it('sin slot activo (nunca ocupo), ocupa directamente', async () => {
      const calendarPort = calendarPortWith({
        findActiveSlotId: jest.fn().mockResolvedValue(null),
      });
      const service = new AvailabilityService({} as VehicleStatusPort, calendarPort);

      await service.moveOccupancy('company-1', 'vehicle-1', range(), 'reservation-1');

      expect(calendarPort.occupy).toHaveBeenCalledTimes(1);
      expect(calendarPort.move).not.toHaveBeenCalled();
    });
  });
});
