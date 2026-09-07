import { BillingContact } from '../value-objects/billing-contact';
import { LegalName } from '../value-objects/legal-name';
import { TaxId } from '../value-objects/tax-id';
import { Company } from './company';

function createCompany(): Company {
  return Company.create({
    legalName: LegalName.from('Renta Demo SA'),
    taxId: TaxId.from('TAX-001'),
    billingContact: BillingContact.from({ email: 'billing@example.com' }),
  });
}

describe('Company', () => {
  describe('create', () => {
    it('crea una company Active y emite CompanyRegistered.v1', () => {
      const company = createCompany();

      expect(company.status).toBe('Active');
      expect(company.isNew).toBe(true);
      const events = company.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'CompanyRegistered.v1',
        legalName: 'Renta Demo SA',
        taxId: 'TAX-001',
      });
    });
  });

  describe('suspend/reactivate', () => {
    it('suspend() transiciona a Suspended, emite CompanySuspended.v1, y es idempotente', () => {
      const company = createCompany();
      company.pullDomainEvents();

      company.suspend('impago de suscripcion');
      expect(company.status).toBe('Suspended');
      const events = company.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'CompanySuspended.v1',
        reason: 'impago de suscripcion',
      });

      // Segunda llamada sobre una company ya Suspended: no-op, sin evento duplicado.
      company.suspend('otra razon');
      expect(company.pullDomainEvents()).toHaveLength(0);
    });

    it('reactivate() vuelve a Active sin emitir evento propio (no esta en el catalogo)', () => {
      const company = createCompany();
      company.suspend('impago');
      company.pullDomainEvents();

      company.reactivate();

      expect(company.status).toBe('Active');
      expect(company.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('updateDetails', () => {
    it('reemplaza legalName/billingContact solo si se proveen', () => {
      const company = createCompany();

      company.updateDetails({ legalName: LegalName.from('Nuevo Nombre SA') });

      expect(company.legalName.toString()).toBe('Nuevo Nombre SA');
      expect(company.billingContact.toEmail().toString()).toBe('billing@example.com');
    });
  });
});
