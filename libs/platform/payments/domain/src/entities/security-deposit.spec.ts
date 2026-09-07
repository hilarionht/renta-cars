import { Money } from '@platform/shared-kernel';

import { DepositRetentionExceedsHeldError } from '../errors/deposit-retention-exceeds-held.error';
import { SecurityDepositAlreadyResolvedError } from '../errors/security-deposit-already-resolved.error';
import { SecurityDeposit } from './security-deposit';

function holdDeposit(): SecurityDeposit {
  return SecurityDeposit.hold({
    companyId: 'company-1',
    reservationId: 'reservation-1',
    amount: Money.from(50000, 'MXN'),
  });
}

describe('SecurityDeposit', () => {
  describe('hold', () => {
    it('crea el deposit Held, version 1, y emite SecurityDepositHeld.v1', () => {
      const deposit = holdDeposit();

      expect(deposit.status).toBe('Held');
      expect(deposit.version).toBe(1);
      expect(deposit.isNew).toBe(true);
      const events = deposit.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'SecurityDepositHeld.v1',
        reservationId: 'reservation-1',
        amount: { minorUnits: 50000, currency: 'MXN' },
      });
    });
  });

  describe('release', () => {
    it('transiciona Held -> ReleasedFully y emite SecurityDepositReleased.v1', () => {
      const deposit = holdDeposit();
      deposit.pullDomainEvents();

      deposit.release();

      expect(deposit.status).toBe('ReleasedFully');
      expect(deposit.version).toBe(2);
      const events = deposit.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'SecurityDepositReleased.v1' });
    });

    it('lanza SecurityDepositAlreadyResolvedError si ya esta resuelto (INV-020)', () => {
      const deposit = holdDeposit();
      deposit.release();

      expect(() => deposit.release()).toThrow(SecurityDepositAlreadyResolvedError);
    });
  });

  describe('retain', () => {
    it('retiene el monto completo -> RetainedFully, emite SecurityDepositPartiallyRetained.v1', () => {
      const deposit = holdDeposit();
      deposit.pullDomainEvents();

      deposit.retain(Money.from(50000, 'MXN'), 'dano en la carroceria');

      expect(deposit.status).toBe('RetainedFully');
      expect(deposit.retainedAmount?.minorUnits).toBe(50000);
      expect(deposit.retentionReason).toBe('dano en la carroceria');
      const events = deposit.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'SecurityDepositPartiallyRetained.v1',
        retainedAmount: { minorUnits: 50000, currency: 'MXN' },
        reason: 'dano en la carroceria',
      });
    });

    it('retiene un monto parcial -> RetainedPartially', () => {
      const deposit = holdDeposit();

      deposit.retain(Money.from(20000, 'MXN'), 'combustible faltante');

      expect(deposit.status).toBe('RetainedPartially');
      expect(deposit.retainedAmount?.minorUnits).toBe(20000);
    });

    it('lanza DepositRetentionExceedsHeldError si el monto excede lo retenido (INV-019)', () => {
      const deposit = holdDeposit();

      expect(() => deposit.retain(Money.from(60000, 'MXN'), 'x')).toThrow(
        DepositRetentionExceedsHeldError,
      );
    });

    it('lanza SecurityDepositAlreadyResolvedError si ya esta resuelto (INV-020)', () => {
      const deposit = holdDeposit();
      deposit.release();

      expect(() => deposit.retain(Money.from(10000, 'MXN'), 'x')).toThrow(
        SecurityDepositAlreadyResolvedError,
      );
    });
  });
});
