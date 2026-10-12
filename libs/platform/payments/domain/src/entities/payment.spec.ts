import { Money } from '@platform/shared-kernel';

import { PaymentInvalidStateTransitionError } from '../errors/payment-invalid-state-transition.error';
import { PaymentMethod } from '../value-objects/payment-method';
import { Payment } from './payment';

function requestPayment(method = 'Card'): Payment {
  return Payment.request({
    companyId: 'company-1',
    targetType: 'SecurityDeposit',
    targetId: 'deposit-1',
    amount: Money.from(50000, 'MXN'),
    method: PaymentMethod.from(method),
    idempotencyKey: 'idem-1',
  });
}

describe('Payment', () => {
  describe('request', () => {
    it('crea el payment Requested, version 1, sin evento propio', () => {
      const payment = requestPayment();

      expect(payment.status).toBe('Requested');
      expect(payment.version).toBe(1);
      expect(payment.isNew).toBe(true);
      expect(payment.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('authorize', () => {
    it('transiciona Requested -> Authorized, bumpea version, sin evento propio', () => {
      const payment = requestPayment();

      payment.authorize('gw-ref-1');

      expect(payment.status).toBe('Authorized');
      expect(payment.version).toBe(2);
      expect(payment.gatewayReference).toBe('gw-ref-1');
      expect(payment.pullDomainEvents()).toHaveLength(0);
    });

    it('lanza PaymentInvalidStateTransitionError si no esta Requested', () => {
      const payment = requestPayment();
      payment.authorize('gw-ref-1');

      expect(() => payment.authorize('gw-ref-2')).toThrow(PaymentInvalidStateTransitionError);
    });
  });

  describe('capture', () => {
    it('transiciona Requested -> Captured directamente (sin preautorizacion) y emite PaymentSucceeded.v1', () => {
      const payment = requestPayment('Cash');

      payment.capture();

      expect(payment.status).toBe('Captured');
      expect(payment.version).toBe(2);
      const events = payment.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'PaymentSucceeded.v1',
        targetType: 'SecurityDeposit',
        targetId: 'deposit-1',
        method: 'Cash',
      });
    });

    it('transiciona Authorized -> Captured y emite PaymentSucceeded.v1', () => {
      const payment = requestPayment();
      payment.authorize('gw-ref-1');

      payment.capture('gw-ref-2');

      expect(payment.status).toBe('Captured');
      expect(payment.gatewayReference).toBe('gw-ref-2');
      expect(payment.pullDomainEvents()).toHaveLength(1);
    });

    it('lanza PaymentInvalidStateTransitionError si ya esta Captured', () => {
      const payment = requestPayment('Cash');
      payment.capture();

      expect(() => payment.capture()).toThrow(PaymentInvalidStateTransitionError);
    });
  });

  describe('fail', () => {
    it('transiciona Requested -> Failed y emite PaymentFailed.v1', () => {
      const payment = requestPayment();

      payment.fail('tarjeta declinada');

      expect(payment.status).toBe('Failed');
      expect(payment.failureReason).toBe('tarjeta declinada');
      const events = payment.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'PaymentFailed.v1',
        reason: 'tarjeta declinada',
      });
    });

    it('lanza PaymentInvalidStateTransitionError si ya esta Captured', () => {
      const payment = requestPayment('Cash');
      payment.capture();

      expect(() => payment.fail('x')).toThrow(PaymentInvalidStateTransitionError);
    });
  });

  describe('refund', () => {
    it('transiciona Captured -> Refunded y emite PaymentRefunded.v1', () => {
      const payment = requestPayment('Cash');
      payment.capture();
      payment.pullDomainEvents();

      payment.refund();

      expect(payment.status).toBe('Refunded');
      const events = payment.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'PaymentRefunded.v1' });
    });

    it('lanza PaymentInvalidStateTransitionError si no esta Captured', () => {
      const payment = requestPayment();

      expect(() => payment.refund()).toThrow(PaymentInvalidStateTransitionError);
    });
  });
});
