import { FuelLevel } from '../value-objects/fuel-level';
import { Odometer } from '../value-objects/odometer';
import { Inspection } from './inspection';

describe('Inspection', () => {
  it('register() crea una inspection con id propio', () => {
    const inspection = Inspection.register({
      type: 'CheckOut',
      odometer: Odometer.from(1000),
      fuelLevel: FuelLevel.from(100),
      photoFileIds: ['file-1'],
      inspectedBy: 'user-1',
    });

    expect(inspection.type).toBe('CheckOut');
    expect(inspection.odometer.value).toBe(1000);
    expect(inspection.fuelLevel.value).toBe(100);
    expect(inspection.photoFileIds).toEqual(['file-1']);
    expect(inspection.inspectedBy).toBe('user-1');
    expect(inspection.id).toBeDefined();
  });

  it('reconstitute() reconstruye desde props persistidas', () => {
    const inspectedAt = new Date('2026-01-01T00:00:00Z');
    const inspection = Inspection.register({
      type: 'CheckIn',
      odometer: Odometer.from(1200),
      fuelLevel: FuelLevel.from(50),
      photoFileIds: [],
      inspectedBy: 'user-2',
    });
    const reconstituted = Inspection.reconstitute({
      id: inspection.id,
      type: 'CheckIn',
      odometer: Odometer.from(1200),
      fuelLevel: FuelLevel.from(50),
      photoFileIds: [],
      inspectedAt,
      inspectedBy: 'user-2',
    });

    expect(reconstituted.inspectedAt).toBe(inspectedAt);
  });
});
