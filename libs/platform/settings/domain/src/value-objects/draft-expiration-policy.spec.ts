import { InvalidValueError } from '@platform/shared-kernel';

import { DraftExpirationPolicy } from './draft-expiration-policy';

describe('DraftExpirationPolicy', () => {
  it('from() acepta un valor positivo', () => {
    expect(DraftExpirationPolicy.from(60).expirationMinutes).toBe(60);
  });

  it('from() rechaza cero o negativo', () => {
    expect(() => DraftExpirationPolicy.from(0)).toThrow(InvalidValueError);
    expect(() => DraftExpirationPolicy.from(-1)).toThrow(InvalidValueError);
  });

  it('default() usa 24 horas', () => {
    expect(DraftExpirationPolicy.default().expirationMinutes).toBe(1440);
  });
});
