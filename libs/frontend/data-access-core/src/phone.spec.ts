import { normalizePhoneNumber } from './phone';

// docs/persistence/10-DECISIONES.md #139.
describe('normalizePhoneNumber (Argentina por defecto)', () => {
  it.each([
    ['11 5555-4444', '+5491155554444'],
    ['011 5555 4444', '+5491155554444'],
    ['(0351) 555-4444', '+5493515554444'],
    ['9 11 5555 4444', '+5491155554444'],
    ['5491155554444', '+5491155554444'],
    ['541155554444', '+5491155554444'],
    ['+54 11 5555 4444', '+5491155554444'],
    ['+54 9 11 5555-4444', '+5491155554444'],
    ['0054 9 11 5555 4444', '+5491155554444'],
    ['+52 55 1234 5678', '+525512345678'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhoneNumber(input)).toEqual({ ok: true, e164: expected });
  });

  it('pide el numero sin el 15', () => {
    const result = normalizePhoneNumber('011 15 5555-4444');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/sin el 15/);
  });

  it.each(['', '   ', '5555-4444', '+12', 'abc', '11 5555 44x4'])('rechaza "%s"', (input) => {
    expect(normalizePhoneNumber(input).ok).toBe(false);
  });
});
