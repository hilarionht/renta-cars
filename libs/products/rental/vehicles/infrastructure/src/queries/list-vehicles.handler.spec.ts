import type { CalendarPort } from '@platform/calendar/application';
import { InvalidDateRangeError } from '@rental/vehicles/domain';

import { ListVehiclesHandler } from './list-vehicles.handler';

function vehicleRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'vehicle-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    vehicleCategoryId: 'category-1',
    licensePlate: 'ABC-123',
    vin: 'VIN123',
    status: 'Available',
    ...overrides,
  };
}

describe('ListVehiclesHandler', () => {
  it('sin rango de fechas, lista todo el fleet sin consultar CalendarPort (comportamiento actual intacto)', async () => {
    const findMany = jest.fn().mockResolvedValue([vehicleRecord()]);
    const readTransaction = {
      run: (fn: (tx: unknown) => unknown) => fn({ vehicle: { findMany } }),
    };
    const calendarPort: CalendarPort = {
      isAvailable: jest.fn(),
      occupy: jest.fn(),
      release: jest.fn(),
      findActiveSlotId: jest.fn(),
      findOccupiedResourceIds: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = new ListVehiclesHandler(readTransaction as any, calendarPort);

    const result = await handler.execute({ companyId: 'company-1' });

    expect(result).toHaveLength(1);
    expect(calendarPort.findOccupiedResourceIds).not.toHaveBeenCalled();
  });

  it('con rango de fechas, filtra a status operable y descarta los vehiculos ocupados', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([vehicleRecord({ id: 'vehicle-1' }), vehicleRecord({ id: 'vehicle-2' })]);
    const readTransaction = {
      run: (fn: (tx: unknown) => unknown) => fn({ vehicle: { findMany } }),
    };
    const calendarPort: CalendarPort = {
      isAvailable: jest.fn(),
      occupy: jest.fn(),
      release: jest.fn(),
      findActiveSlotId: jest.fn(),
      findOccupiedResourceIds: jest.fn().mockResolvedValue(['vehicle-2']),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = new ListVehiclesHandler(readTransaction as any, calendarPort);

    const startDate = new Date('2026-09-01T00:00:00Z');
    const endDate = new Date('2026-09-05T00:00:00Z');
    const result = await handler.execute({ companyId: 'company-1', startDate, endDate });

    expect(result.map((vehicle) => vehicle.id)).toEqual(['vehicle-1']);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { notIn: ['OutOfService', 'Maintenance'] } }),
      }),
    );
    expect(calendarPort.findOccupiedResourceIds).toHaveBeenCalledWith(
      'vehicle',
      ['vehicle-1', 'vehicle-2'],
      startDate,
      endDate,
    );
  });

  it('lanza InvalidDateRangeError si startDate no es anterior a endDate, sin consultar Prisma ni CalendarPort', async () => {
    const findMany = jest.fn();
    const readTransaction = {
      run: (fn: (tx: unknown) => unknown) => fn({ vehicle: { findMany } }),
    };
    const calendarPort: CalendarPort = {
      isAvailable: jest.fn(),
      occupy: jest.fn(),
      release: jest.fn(),
      findActiveSlotId: jest.fn(),
      findOccupiedResourceIds: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = new ListVehiclesHandler(readTransaction as any, calendarPort);

    const startDate = new Date('2026-09-05T00:00:00Z');
    const endDate = new Date('2026-09-01T00:00:00Z');

    await expect(handler.execute({ companyId: 'company-1', startDate, endDate })).rejects.toThrow(
      InvalidDateRangeError,
    );
    expect(findMany).not.toHaveBeenCalled();
    expect(calendarPort.findOccupiedResourceIds).not.toHaveBeenCalled();
  });
});
