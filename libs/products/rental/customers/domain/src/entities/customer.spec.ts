import { ContactInfo } from '../value-objects/contact-info';
import { CustomerName } from '../value-objects/customer-name';
import { TaxIdOrDocumentId } from '../value-objects/tax-id-or-document-id';
import { AdditionalDriverNotFoundError } from '../errors/additional-driver-not-found.error';
import { Customer } from './customer';

function createCustomer(): Customer {
  return Customer.create({
    companyId: 'company-1',
    name: CustomerName.from('Juan Perez'),
    taxIdOrDocumentId: TaxIdOrDocumentId.from('DOC-0001'),
    contactInfo: ContactInfo.from({ email: 'juan@example.com', phone: '+525512345678' }),
    customerType: 'Individual',
  });
}

function uploadOwnDocument(customer: Customer, expiryDate = new Date('2030-01-01')): string {
  return customer
    .uploadIdentityDocument({
      owner: { type: 'Customer', id: customer.id.toString() },
      documentType: 'NationalId',
      fileId: 'file-1',
      expiryDate,
    })
    .toString();
}

describe('Customer', () => {
  describe('create', () => {
    it('crea el customer Registered/None, version 1, y emite CustomerRegistered.v1', () => {
      const customer = createCustomer();

      expect(customer.status).toBe('Registered');
      expect(customer.blockStatus).toBe('None');
      expect(customer.version).toBe(1);
      expect(customer.isNew).toBe(true);
      const events = customer.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'CustomerRegistered.v1',
        customerType: 'Individual',
      });
    });
  });

  describe('uploadIdentityDocument', () => {
    it('agrega el documento, lo marca dirty, bumpea version y no emite evento propio', () => {
      const customer = createCustomer();
      customer.pullDomainEvents();

      const documentId = uploadOwnDocument(customer);

      expect(customer.version).toBe(2);
      expect(customer.pullDomainEvents()).toHaveLength(0);
      const dirty = customer.pullDirtyIdentityDocuments();
      expect(dirty).toHaveLength(1);
      expect(dirty[0].id.toString()).toBe(documentId);
    });

    it('lanza AdditionalDriverNotFoundError si el owner es un driver que no existe', () => {
      const customer = createCustomer();

      expect(() =>
        customer.uploadIdentityDocument({
          owner: { type: 'AdditionalDriver', id: 'driver-inexistente' },
          documentType: 'DriversLicense',
          fileId: 'file-1',
          expiryDate: new Date('2030-01-01'),
        }),
      ).toThrow(AdditionalDriverNotFoundError);
    });
  });

  describe('verifyIdentityDocument', () => {
    it('verifica el documento, bumpea version y emite CustomerDocumentValidated.v1', () => {
      const customer = createCustomer();
      const documentId = uploadOwnDocument(customer);
      customer.pullDomainEvents();
      customer.pullDirtyIdentityDocuments();
      const versionBeforeVerify = customer.version;

      customer.verifyIdentityDocument(documentId);

      expect(customer.version).toBe(versionBeforeVerify + 1);
      const events = customer.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'CustomerDocumentValidated.v1', documentId });
      expect(customer.pullDirtyIdentityDocuments()).toHaveLength(1);
    });

    it('efecto lateral: transiciona status Registered -> Active al verificar el documento propio', () => {
      const customer = createCustomer();
      const documentId = uploadOwnDocument(customer);

      customer.verifyIdentityDocument(documentId);

      expect(customer.status).toBe('Active');
    });

    it('NO transiciona a Active si el documento verificado es de un AdditionalDriver', () => {
      const customer = createCustomer();
      const driverId = customer.registerAdditionalDriver('Maria Lopez').toString();
      const licenseId = customer
        .uploadIdentityDocument({
          owner: { type: 'AdditionalDriver', id: driverId },
          documentType: 'DriversLicense',
          fileId: 'file-license',
          expiryDate: new Date('2030-01-01'),
        })
        .toString();

      customer.verifyIdentityDocument(licenseId);

      expect(customer.status).toBe('Registered');
    });

    it('es idempotente si el documento ya esta Verified: no vuelve a bumpear version ni a emitir el evento', () => {
      const customer = createCustomer();
      const documentId = uploadOwnDocument(customer);
      customer.verifyIdentityDocument(documentId);
      customer.pullDomainEvents();
      customer.pullDirtyIdentityDocuments();
      const versionAfterFirstVerify = customer.version;

      customer.verifyIdentityDocument(documentId);

      expect(customer.version).toBe(versionAfterFirstVerify);
      expect(customer.pullDomainEvents()).toHaveLength(0);
      expect(customer.pullDirtyIdentityDocuments()).toHaveLength(0);
    });
  });

  describe('registerAdditionalDriver / validateAdditionalDriverLicense / revokeAdditionalDriver', () => {
    it('registerAdditionalDriver agrega el driver, bumpea version y emite AdditionalDriverRegistered.v1', () => {
      const customer = createCustomer();
      customer.pullDomainEvents();

      const driverId = customer.registerAdditionalDriver('Maria Lopez').toString();

      expect(customer.version).toBe(2);
      const events = customer.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'AdditionalDriverRegistered.v1', driverId });
      expect(customer.pullDirtyAdditionalDrivers()).toHaveLength(1);
    });

    it('validateAdditionalDriverLicense con licencia vigente bumpea version y emite AdditionalDriverValidated.v1 (INV-012)', () => {
      const customer = createCustomer();
      const driverId = customer.registerAdditionalDriver('Maria Lopez').toString();
      const licenseId = customer
        .uploadIdentityDocument({
          owner: { type: 'AdditionalDriver', id: driverId },
          documentType: 'DriversLicense',
          fileId: 'file-license',
          expiryDate: new Date('2030-01-01'),
        })
        .toString();
      customer.verifyIdentityDocument(licenseId);
      customer.pullDomainEvents();
      const versionBeforeValidate = customer.version;

      customer.validateAdditionalDriverLicense(driverId);

      expect(customer.version).toBe(versionBeforeValidate + 1);
      const events = customer.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'AdditionalDriverValidated.v1', driverId });
    });

    it('revokeAdditionalDriver bumpea version, emite AdditionalDriverRevoked.v1 y es idempotente', () => {
      const customer = createCustomer();
      const driverId = customer.registerAdditionalDriver('Maria Lopez').toString();
      customer.pullDomainEvents();
      const versionBeforeRevoke = customer.version;

      customer.revokeAdditionalDriver(driverId);

      expect(customer.version).toBe(versionBeforeRevoke + 1);
      const events = customer.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'AdditionalDriverRevoked.v1', driverId });

      // Segunda llamada: no-op, sin bumpear version ni reemitir el evento.
      const versionAfterFirstRevoke = customer.version;
      customer.revokeAdditionalDriver(driverId);
      expect(customer.version).toBe(versionAfterFirstRevoke);
      expect(customer.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('block/unblock', () => {
    it('block() transiciona a Blocked, bumpea version, emite CustomerBlocked.v1, y es idempotente', () => {
      const customer = createCustomer();
      customer.pullDomainEvents();

      customer.block('fraude sospechoso');

      expect(customer.blockStatus).toBe('Blocked');
      expect(customer.version).toBe(2);
      expect(customer.pullDomainEvents()).toHaveLength(1);

      customer.block('otra razon');
      expect(customer.version).toBe(2);
      expect(customer.pullDomainEvents()).toHaveLength(0);
    });

    it('unblock() vuelve a None, bumpea version y emite CustomerUnblocked.v1', () => {
      const customer = createCustomer();
      customer.block('fraude sospechoso');
      customer.pullDomainEvents();

      customer.unblock('admin-1');

      expect(customer.blockStatus).toBe('None');
      expect(customer.version).toBe(3);
      expect(customer.pullDomainEvents()).toHaveLength(1);
    });
  });

  describe('isEligibleForConfirmation', () => {
    it('false si Blocked, incluso con documentacion vigente', () => {
      const customer = createCustomer();
      const documentId = uploadOwnDocument(customer);
      customer.verifyIdentityDocument(documentId);
      customer.block('fraude');

      expect(customer.isEligibleForConfirmation()).toBe(false);
    });

    it('false si status no es Active', () => {
      const customer = createCustomer();

      expect(customer.isEligibleForConfirmation()).toBe(false);
    });

    it('true si Active, no bloqueado, y con documento propio vigente', () => {
      const customer = createCustomer();
      const documentId = uploadOwnDocument(customer);
      customer.verifyIdentityDocument(documentId);

      expect(customer.isEligibleForConfirmation()).toBe(true);
    });
  });
});
