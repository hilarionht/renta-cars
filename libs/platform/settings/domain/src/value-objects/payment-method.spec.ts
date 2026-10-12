import { PAYMENT_METHODS, PaymentMethod } from './payment-method';
import { InvalidPaymentMethodError } from '../errors/invalid-payment-method.error';

describe('PaymentMethod', () => {
  it.each(PAYMENT_METHODS)('from() acepta "%s" (catalogo cerrado)', (method) => {
    expect(PaymentMethod.from(method).toString()).toBe(method);
  });

  it('from() rechaza un valor fuera del catalogo con InvalidPaymentMethodError', () => {
    expect(() => PaymentMethod.from('Bitcoin')).toThrow(InvalidPaymentMethodError);
  });
});
