import { InvalidValueError } from '@platform/shared-kernel';

import { billingPhoneFromInput } from './billing-phone';

// docs/persistence/10-DECISIONES.md #140.
describe('billingPhoneFromInput', () => {
  it('acepta E.164 y vacio', () => {
    expect(billingPhoneFromInput('+5491155554444')).toBe('+5491155554444');
    expect(billingPhoneFromInput('   ')).toBeUndefined();
    expect(billingPhoneFromInput(undefined)).toBeUndefined();
  });

  it('rechaza un telefono que no es E.164', () => {
    expect(() => billingPhoneFromInput('abc')).toThrow(InvalidValueError);
  });
});
