import { VehicleDocumentExpiredError } from '../errors/vehicle-document-expired.error';
import { VehicleDocumentReplacedError } from '../errors/vehicle-document-replaced.error';
import { VehicleDocumentationIncompleteError } from '../errors/vehicle-documentation-incomplete.error';
import { LicensePlate } from '../value-objects/license-plate';
import { VIN } from '../value-objects/vin';
import { Vehicle } from './vehicle';

// docs/persistence/10-DECISIONES.md #139: renovacion de documentos del vehiculo y habilitacion
// solo con un documento vigente.
function createVehicle(): Vehicle {
  return Vehicle.create({
    companyId: 'company-1',
    branchId: 'branch-1',
    vehicleCategoryId: 'category-1',
    licensePlate: LicensePlate.from('ABC-1234'),
    vin: VIN.from('1HGCM82633A123456'),
  });
}

const DAY = 86_400_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

const upload = (
  vehicle: Vehicle,
  expiryDate: Date,
  documentType: 'Insurance' | 'PropertyCard' = 'Insurance',
) => vehicle.uploadDocument({ documentType, fileId: 'f', expiryDate }).toString();

const statusOf = (vehicle: Vehicle, id: string) =>
  vehicle.allVehicleDocuments.find((document) => document.id.toString() === id)?.status;

describe('Vehicle: renovacion de documentos', () => {
  it('se renueva el seguro: el viejo vale hasta verificar el nuevo', () => {
    const vehicle = createVehicle();
    const oldId = upload(vehicle, inDays(10));
    vehicle.verifyDocument(oldId);

    const newId = upload(vehicle, inDays(400));
    expect(statusOf(vehicle, oldId)).toBe('Verified');

    vehicle.verifyDocument(newId);
    expect(statusOf(vehicle, oldId)).toBe('Replaced');
    expect(statusOf(vehicle, newId)).toBe('Verified');
  });

  it('no se puede verificar un documento vencido ni uno reemplazado', () => {
    const vehicle = createVehicle();
    const expiredId = upload(vehicle, inDays(-1));
    expect(() => vehicle.verifyDocument(expiredId)).toThrow(VehicleDocumentExpiredError);

    upload(vehicle, inDays(300));
    expect(() => vehicle.verifyDocument(expiredId)).toThrow(VehicleDocumentReplacedError);
  });

  it('renovar un tipo no reemplaza documentos de otro tipo', () => {
    const vehicle = createVehicle();
    const cardId = upload(vehicle, inDays(300), 'PropertyCard');
    vehicle.verifyDocument(cardId);
    const insuranceId = upload(vehicle, inDays(300), 'Insurance');
    vehicle.verifyDocument(insuranceId);

    expect(statusOf(vehicle, cardId)).toBe('Verified');
  });

  it('no se habilita sin un documento verificado y vigente', () => {
    const vehicle = createVehicle();
    expect(() => vehicle.enable()).toThrow(VehicleDocumentationIncompleteError);

    const id = upload(vehicle, inDays(300));
    vehicle.verifyDocument(id);
    expect(() => vehicle.enable()).not.toThrow();
    expect(vehicle.status).toBe('Available');
  });
});
