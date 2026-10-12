import { LicensePlate } from '../value-objects/license-plate';
import { VIN } from '../value-objects/vin';
import { MaintenanceRecordNotFoundError } from '../errors/maintenance-record-not-found.error';
import { VehicleDocumentationIncompleteError } from '../errors/vehicle-documentation-incomplete.error';
import { VehicleInvalidStateTransitionError } from '../errors/vehicle-invalid-state-transition.error';
import { Vehicle } from './vehicle';

function createVehicle(): Vehicle {
  return Vehicle.create({
    companyId: 'company-1',
    branchId: 'branch-1',
    vehicleCategoryId: 'category-1',
    licensePlate: LicensePlate.from('ABC-1234'),
    vin: VIN.from('1HGCM82633A123456'),
  });
}

function uploadAndVerifyDocument(vehicle: Vehicle, expiryDate = new Date('2030-01-01')): string {
  const documentId = vehicle
    .uploadDocument({ documentType: 'PropertyCard', fileId: 'file-1', expiryDate })
    .toString();
  vehicle.verifyDocument(documentId);
  return documentId;
}

describe('Vehicle', () => {
  describe('create', () => {
    it('crea el vehicle Registered, version 1, y emite VehicleRegistered.v1', () => {
      const vehicle = createVehicle();

      expect(vehicle.status).toBe('Registered');
      expect(vehicle.version).toBe(1);
      expect(vehicle.isNew).toBe(true);
      const events = vehicle.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'VehicleRegistered.v1' });
    });
  });

  describe('uploadDocument', () => {
    it('agrega el documento, bumpea version, y emite VehicleDocumentationLoaded.v1 (regresion #46: bumpea aunque solo toque un hijo)', () => {
      const vehicle = createVehicle();
      vehicle.pullDomainEvents();

      const documentId = vehicle
        .uploadDocument({
          documentType: 'PropertyCard',
          fileId: 'file-1',
          expiryDate: new Date('2030-01-01'),
        })
        .toString();

      expect(vehicle.version).toBe(2);
      const events = vehicle.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'VehicleDocumentationLoaded.v1', documentId });
      expect(vehicle.pullDirtyVehicleDocuments()).toHaveLength(1);
    });
  });

  describe('verifyDocument', () => {
    it('verifica el documento y bumpea version', () => {
      const vehicle = createVehicle();
      const documentId = vehicle
        .uploadDocument({
          documentType: 'PropertyCard',
          fileId: 'file-1',
          expiryDate: new Date('2030-01-01'),
        })
        .toString();
      const versionBeforeVerify = vehicle.version;

      vehicle.verifyDocument(documentId);

      expect(vehicle.version).toBe(versionBeforeVerify + 1);
      expect(vehicle.allVehicleDocuments[0].status).toBe('Verified');
    });

    it('es idempotente si el documento ya esta Verified: no vuelve a bumpear version', () => {
      const vehicle = createVehicle();
      const documentId = uploadAndVerifyDocument(vehicle);
      vehicle.pullDirtyVehicleDocuments();
      const versionAfterFirstVerify = vehicle.version;

      vehicle.verifyDocument(documentId);

      expect(vehicle.version).toBe(versionAfterFirstVerify);
      expect(vehicle.pullDirtyVehicleDocuments()).toHaveLength(0);
    });
  });

  describe('enable', () => {
    it('INV-007: lanza VehicleDocumentationIncompleteError sin documento verificado', () => {
      const vehicle = createVehicle();

      expect(() => vehicle.enable()).toThrow(VehicleDocumentationIncompleteError);
    });

    it('transiciona Registered -> Available con al menos un documento Verified, emite VehicleEnabled.v1', () => {
      const vehicle = createVehicle();
      uploadAndVerifyDocument(vehicle);

      vehicle.enable();

      expect(vehicle.status).toBe('Available');
      expect(
        vehicle.pullDomainEvents().some((event) => event.eventType === 'VehicleEnabled.v1'),
      ).toBe(true);
    });

    it('lanza VehicleInvalidStateTransitionError si no esta Registered', () => {
      const vehicle = createVehicle();
      uploadAndVerifyDocument(vehicle);
      vehicle.enable();

      expect(() => vehicle.enable()).toThrow(VehicleInvalidStateTransitionError);
    });
  });

  describe('scheduleMaintenance / startMaintenance / completeMaintenance', () => {
    function enabledVehicle(): Vehicle {
      const vehicle = createVehicle();
      uploadAndVerifyDocument(vehicle);
      vehicle.enable();
      vehicle.pullDomainEvents();
      return vehicle;
    }

    it('scheduleMaintenance crea el registro, transiciona a Maintenance, bumpea version y emite ambos eventos', () => {
      const vehicle = enabledVehicle();

      const maintenanceId = vehicle
        .scheduleMaintenance({
          type: 'Preventive',
          scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
          scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
        })
        .toString();

      expect(vehicle.status).toBe('Maintenance');
      const events = vehicle.pullDomainEvents();
      expect(events.map((event) => event.eventType)).toEqual([
        'MaintenanceScheduled.v1',
        'VehicleStatusChanged.v1',
      ]);
      expect(vehicle.pullDirtyMaintenanceRecords().map((record) => record.id.toString())).toContain(
        maintenanceId,
      );
    });

    it('lanza VehicleInvalidStateTransitionError si el vehicle esta Registered', () => {
      const vehicle = createVehicle();

      expect(() =>
        vehicle.scheduleMaintenance({
          type: 'Preventive',
          scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
          scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
        }),
      ).toThrow(VehicleInvalidStateTransitionError);
    });

    it('startMaintenance transiciona el registro a InProgress y bumpea version', () => {
      const vehicle = enabledVehicle();
      const maintenanceId = vehicle
        .scheduleMaintenance({
          type: 'Preventive',
          scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
          scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
        })
        .toString();
      vehicle.pullDirtyMaintenanceRecords();
      const versionBeforeStart = vehicle.version;

      vehicle.startMaintenance(maintenanceId);

      expect(vehicle.version).toBe(versionBeforeStart + 1);
      expect(vehicle.allMaintenanceRecords[0].status).toBe('InProgress');
    });

    it('startMaintenance lanza MaintenanceRecordNotFoundError si el id no existe', () => {
      const vehicle = enabledVehicle();

      expect(() => vehicle.startMaintenance('inexistente')).toThrow(MaintenanceRecordNotFoundError);
    });

    it('completeMaintenance(true) vuelve a Available y emite MaintenanceCompleted.v1 + VehicleStatusChanged.v1', () => {
      const vehicle = enabledVehicle();
      const maintenanceId = vehicle
        .scheduleMaintenance({
          type: 'Preventive',
          scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
          scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
        })
        .toString();
      vehicle.startMaintenance(maintenanceId);
      vehicle.pullDomainEvents();

      vehicle.completeMaintenance(maintenanceId, true);

      expect(vehicle.status).toBe('Available');
      const events = vehicle.pullDomainEvents();
      expect(events.map((event) => event.eventType)).toEqual([
        'MaintenanceCompleted.v1',
        'VehicleStatusChanged.v1',
      ]);
      expect(vehicle.allMaintenanceRecords).toHaveLength(1);
    });

    it('completeMaintenance(false) permanece en Maintenance y crea un nuevo MaintenanceRecord Scheduled', () => {
      const vehicle = enabledVehicle();
      const maintenanceId = vehicle
        .scheduleMaintenance({
          type: 'Corrective',
          scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
          scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
        })
        .toString();
      vehicle.startMaintenance(maintenanceId);
      vehicle.pullDomainEvents();

      vehicle.completeMaintenance(maintenanceId, false);

      expect(vehicle.status).toBe('Maintenance');
      const events = vehicle.pullDomainEvents();
      expect(events.map((event) => event.eventType)).toEqual(['MaintenanceCompleted.v1']);
      expect(vehicle.allMaintenanceRecords).toHaveLength(2);
      const retryRecord = vehicle.allMaintenanceRecords.find(
        (record) => record.id.toString() !== maintenanceId,
      );
      expect(retryRecord?.status).toBe('Scheduled');
      expect(retryRecord?.type).toBe('Corrective');
    });
  });

  describe('reportDamage', () => {
    it('Minor transiciona Available -> Maintenance', () => {
      const vehicle = createVehicle();
      uploadAndVerifyDocument(vehicle);
      vehicle.enable();
      vehicle.pullDomainEvents();

      vehicle.reportDamage('Minor', 'rayon en la puerta');

      expect(vehicle.status).toBe('Maintenance');
      const events = vehicle.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'VehicleStatusChanged.v1',
        previousStatus: 'Available',
        newStatus: 'Maintenance',
      });
    });

    it('Severe transiciona Available -> OutOfService', () => {
      const vehicle = createVehicle();
      uploadAndVerifyDocument(vehicle);
      vehicle.enable();

      vehicle.reportDamage('Severe');

      expect(vehicle.status).toBe('OutOfService');
    });

    it('lanza VehicleInvalidStateTransitionError si no esta Available', () => {
      const vehicle = createVehicle();

      expect(() => vehicle.reportDamage('Minor')).toThrow(VehicleInvalidStateTransitionError);
    });
  });

  describe('markOutOfService', () => {
    it('transiciona Available -> OutOfService y emite VehicleStatusChanged.v1', () => {
      const vehicle = createVehicle();
      uploadAndVerifyDocument(vehicle);
      vehicle.enable();
      vehicle.pullDomainEvents();

      vehicle.markOutOfService('averia grave');

      expect(vehicle.status).toBe('OutOfService');
      const events = vehicle.pullDomainEvents();
      expect(events[0]).toMatchObject({
        eventType: 'VehicleStatusChanged.v1',
        reason: 'averia grave',
      });
    });

    it('lanza VehicleInvalidStateTransitionError si no esta Available', () => {
      const vehicle = createVehicle();

      expect(() => vehicle.markOutOfService()).toThrow(VehicleInvalidStateTransitionError);
    });
  });
});
