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
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
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
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
      };
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      const result = await service.isAvailable('vehicle-1', range());

      expect(result).toBe(true);
      expect(calendarPort.isAvailable).toHaveBeenCalledWith(
        'vehicle',
        'vehicle-1',
        range().start,
        range().end,
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
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
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
        findActiveSlotId: jest.fn(),
        findOccupiedResourceIds: jest.fn(),
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
        findActiveSlotId: jest.fn().mockResolvedValue(null),
        findOccupiedResourceIds: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await service.release('vehicle-1');

      expect(calendarPort.release).not.toHaveBeenCalled();
    });

    it('libera el slot activo encontrado', async () => {
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn(),
        release: jest.fn().mockResolvedValue(undefined),
        findActiveSlotId: jest.fn().mockResolvedValue('slot-1'),
        findOccupiedResourceIds: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await service.release('vehicle-1');

      expect(calendarPort.release).toHaveBeenCalledWith('slot-1');
    });
  });

  describe('moveOccupancy', () => {
    it('captura el slot viejo, ocupa el nuevo, y recien despues libera el viejo por id explicito', async () => {
      const callOrder: string[] = [];
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn().mockImplementation(() => {
          callOrder.push('occupy');
          return Promise.resolve('new-slot-id');
        }),
        release: jest.fn().mockImplementation(() => {
          callOrder.push('release');
          return Promise.resolve();
        }),
        findActiveSlotId: jest.fn().mockImplementation(() => {
          callOrder.push('findActiveSlotId');
          return Promise.resolve('old-slot-id');
        }),
        findOccupiedResourceIds: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await service.moveOccupancy('company-1', 'vehicle-1', range(), 'reservation-1');

      expect(callOrder).toEqual(['findActiveSlotId', 'occupy', 'release']);
      expect(calendarPort.release).toHaveBeenCalledWith('old-slot-id');
    });

    it('no libera nada si no habia ningun slot viejo activo', async () => {
      const calendarPort: CalendarPort = {
        isAvailable: jest.fn(),
        occupy: jest.fn().mockResolvedValue('new-slot-id'),
        release: jest.fn(),
        findActiveSlotId: jest.fn().mockResolvedValue(null),
        findOccupiedResourceIds: jest.fn(),
      };
      const vehicleStatusPort = {} as VehicleStatusPort;
      const service = new AvailabilityService(vehicleStatusPort, calendarPort);

      await service.moveOccupancy('company-1', 'vehicle-1', range(), 'reservation-1');

      expect(calendarPort.release).not.toHaveBeenCalled();
    });
  });
});
