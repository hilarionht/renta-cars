import { Address } from '../value-objects/address';
import { BranchName } from '../value-objects/branch-name';
import { OperatingHours } from '../value-objects/operating-hours';
import { Branch } from './branch';

function createBranch(): Branch {
  return Branch.create({
    companyId: 'company-1',
    name: BranchName.from('Sucursal Centro'),
    address: Address.from({ line1: 'Av. Siempre Viva 123', city: 'CABA', country: 'Argentina' }),
    operatingHours: OperatingHours.from([{ day: 'monday', open: '09:00', close: '18:00' }]),
  });
}

describe('Branch', () => {
  describe('create', () => {
    it('crea una branch Active y emite BranchOpened.v1', () => {
      const branch = createBranch();

      expect(branch.status).toBe('Active');
      expect(branch.isNew).toBe(true);
      const events = branch.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'BranchOpened.v1', companyId: 'company-1' });
    });
  });

  describe('close/reopen', () => {
    it('close() transiciona a Closed, emite BranchClosed.v1, y es idempotente', () => {
      const branch = createBranch();
      branch.pullDomainEvents();

      branch.close();
      expect(branch.status).toBe('Closed');
      const events = branch.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'BranchClosed.v1' });

      branch.close();
      expect(branch.pullDomainEvents()).toHaveLength(0);
    });

    it('reopen() vuelve a Active y re-emite BranchOpened.v1 (mismo evento que create())', () => {
      const branch = createBranch();
      branch.close();
      branch.pullDomainEvents();

      branch.reopen();

      expect(branch.status).toBe('Active');
      const events = branch.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'BranchOpened.v1' });
    });

    it('reopen() sobre una branch ya Active es idempotente, sin evento', () => {
      const branch = createBranch();
      branch.pullDomainEvents();

      branch.reopen();

      expect(branch.status).toBe('Active');
      expect(branch.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('updateDetails', () => {
    it('reemplaza name/address/operatingHours solo si se proveen', () => {
      const branch = createBranch();

      branch.updateDetails({ name: BranchName.from('Sucursal Norte') });

      expect(branch.name.toString()).toBe('Sucursal Norte');
      expect(branch.address.toProps().city).toBe('CABA');
    });
  });
});
