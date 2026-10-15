import { canonicalCustomerPhone } from './customer-phone';

// docs/persistence/10-DECISIONES.md #139.
describe('canonicalCustomerPhone', () => {
  it('un celular argentino sin el 9 lo recibe', () => {
    expect(canonicalCustomerPhone('+541155554444')).toBe('+5491155554444');
  });

  it('con el 9 queda igual', () => {
    expect(canonicalCustomerPhone('+5491155554444')).toBe('+5491155554444');
  });

  it('otros paises quedan igual', () => {
    expect(canonicalCustomerPhone('+525500009001')).toBe('+525500009001');
  });

  it('recorta espacios alrededor', () => {
    expect(canonicalCustomerPhone('  +541155554444 ')).toBe('+5491155554444');
  });
});
