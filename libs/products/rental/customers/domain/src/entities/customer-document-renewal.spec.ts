import { IdentityDocumentExpiredError } from '../errors/identity-document-expired.error';
import { IdentityDocumentReplacedError } from '../errors/identity-document-replaced.error';
import { ContactInfo } from '../value-objects/contact-info';
import { CustomerName } from '../value-objects/customer-name';
import { TaxIdOrDocumentId } from '../value-objects/tax-id-or-document-id';
import { Customer } from './customer';

// docs/persistence/10-DECISIONES.md #139: renovacion de documentos (el nuevo reemplaza al
// anterior al verificarse) y licencia de conductor.
function createCustomer(): Customer {
  return Customer.create({
    companyId: 'company-1',
    name: CustomerName.from('Juan Perez'),
    taxIdOrDocumentId: TaxIdOrDocumentId.from('DOC-0001'),
    contactInfo: ContactInfo.from({ email: 'juan@example.com', phone: '+525512345678' }),
    customerType: 'Individual',
  });
}

const DAY = 86_400_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

function upload(
  customer: Customer,
  expiryDate: Date,
  owner: { type: 'Customer' | 'AdditionalDriver'; id: string } = {
    type: 'Customer',
    id: customer.id.toString(),
  },
  documentType: 'NationalId' | 'DriversLicense' = 'NationalId',
): string {
  return customer
    .uploadIdentityDocument({ owner, documentType, fileId: 'f', expiryDate })
    .toString();
}

const statusOf = (customer: Customer, id: string) =>
  customer.allIdentityDocuments.find((document) => document.id.toString() === id)?.status;

describe('Customer: renovacion de documentos', () => {
  it('se puede cargar uno nuevo con otro vigente; el viejo vale hasta verificar el nuevo', () => {
    const customer = createCustomer();
    const oldId = upload(customer, inDays(30));
    customer.verifyIdentityDocument(oldId);

    const newId = upload(customer, inDays(900));
    expect(statusOf(customer, oldId)).toBe('Verified');
    expect(statusOf(customer, newId)).toBe('Pending');

    customer.verifyIdentityDocument(newId);
    expect(statusOf(customer, oldId)).toBe('Replaced');
    expect(statusOf(customer, newId)).toBe('Verified');
    expect(customer.isEligibleForConfirmation()).toBe(true);
  });

  it('un Pending anterior del mismo tipo queda reemplazado al cargar otro', () => {
    const customer = createCustomer();
    const firstId = upload(customer, inDays(-1));
    const secondId = upload(customer, inDays(300));

    expect(statusOf(customer, firstId)).toBe('Replaced');
    expect(statusOf(customer, secondId)).toBe('Pending');
  });

  it('no se puede verificar un documento vencido ni uno reemplazado', () => {
    const customer = createCustomer();
    const expiredId = upload(customer, inDays(-1));
    expect(() => customer.verifyIdentityDocument(expiredId)).toThrow(IdentityDocumentExpiredError);

    upload(customer, inDays(300));
    expect(() => customer.verifyIdentityDocument(expiredId)).toThrow(IdentityDocumentReplacedError);
  });

  it('la renovacion de un dueno no reemplaza documentos de otro dueno ni de otro tipo', () => {
    const customer = createCustomer();
    const driverId = customer.registerAdditionalDriver('Ana').toString();
    const ownId = upload(customer, inDays(300));
    customer.verifyIdentityDocument(ownId);
    const licenseId = upload(
      customer,
      inDays(300),
      { type: 'AdditionalDriver', id: driverId },
      'DriversLicense',
    );
    customer.verifyIdentityDocument(licenseId);

    expect(statusOf(customer, ownId)).toBe('Verified');
    expect(statusOf(customer, licenseId)).toBe('Verified');
  });

  it('la licencia de un conductor tiene que ser DriversLicense (un DNI no cuenta)', () => {
    const customer = createCustomer();
    const driverId = customer.registerAdditionalDriver('Ana').toString();
    const dniId = upload(
      customer,
      inDays(300),
      { type: 'AdditionalDriver', id: driverId },
      'NationalId',
    );
    customer.verifyIdentityDocument(dniId);

    expect(() => customer.validateAdditionalDriverLicense(driverId)).toThrow();

    const licenseId = upload(
      customer,
      inDays(300),
      { type: 'AdditionalDriver', id: driverId },
      'DriversLicense',
    );
    customer.verifyIdentityDocument(licenseId);
    expect(() => customer.validateAdditionalDriverLicense(driverId)).not.toThrow();
  });
});
