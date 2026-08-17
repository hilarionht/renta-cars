import { AdditionalDriverMissingValidLicenseError } from '../errors/additional-driver-missing-valid-license.error';
import { AdditionalDriverRevokedError } from '../errors/additional-driver-revoked.error';
import { IdentityDocument } from './identity-document';
import { AdditionalDriver } from './additional-driver';

function registerDriver(): AdditionalDriver {
  return AdditionalDriver.register({ customerId: 'customer-1', name: 'Maria Lopez' });
}

function validLicense(): IdentityDocument {
  const license = IdentityDocument.upload({
    owner: { type: 'AdditionalDriver', id: 'driver-1' },
    documentType: 'DriversLicense',
    fileId: 'file-license',
    expiryDate: new Date('2030-01-01'),
  });
  license.verify();
  return license;
}

describe('AdditionalDriver', () => {
  describe('register', () => {
    it('crea el driver en Registered, version 1, isNew true', () => {
      const driver = registerDriver();

      expect(driver.status).toBe('Registered');
      expect(driver.version).toBe(1);
      expect(driver.isNew).toBe(true);
    });
  });

  describe('validateLicense', () => {
    it('INV-012: lanza AdditionalDriverMissingValidLicenseError sin licencia', () => {
      const driver = registerDriver();

      expect(() => driver.validateLicense(undefined)).toThrow(
        AdditionalDriverMissingValidLicenseError,
      );
    });

    it('INV-012: lanza AdditionalDriverMissingValidLicenseError con una licencia no vigente (no verificada)', () => {
      const driver = registerDriver();
      const unverifiedLicense = IdentityDocument.upload({
        owner: { type: 'AdditionalDriver', id: 'driver-1' },
        documentType: 'DriversLicense',
        fileId: 'file-license',
        expiryDate: new Date('2030-01-01'),
      });

      expect(() => driver.validateLicense(unverifiedLicense)).toThrow(
        AdditionalDriverMissingValidLicenseError,
      );
    });

    it('transiciona a Validated y bumpea version con una licencia vigente', () => {
      const driver = registerDriver();

      driver.validateLicense(validLicense());

      expect(driver.status).toBe('Validated');
      expect(driver.version).toBe(2);
    });

    it('es idempotente si ya esta Validated (no vuelve a bumpear version)', () => {
      const driver = registerDriver();
      driver.validateLicense(validLicense());

      driver.validateLicense(validLicense());

      expect(driver.status).toBe('Validated');
      expect(driver.version).toBe(2);
    });

    it('lanza AdditionalDriverRevokedError si el driver esta Revoked', () => {
      const driver = registerDriver();
      driver.revoke();

      expect(() => driver.validateLicense(validLicense())).toThrow(AdditionalDriverRevokedError);
    });
  });

  describe('revoke', () => {
    it('transiciona a Revoked y bumpea version', () => {
      const driver = registerDriver();

      driver.revoke();

      expect(driver.status).toBe('Revoked');
      expect(driver.version).toBe(2);
    });

    it('es idempotente si ya esta Revoked (no vuelve a bumpear version)', () => {
      const driver = registerDriver();
      driver.revoke();

      driver.revoke();

      expect(driver.version).toBe(2);
    });
  });
});
