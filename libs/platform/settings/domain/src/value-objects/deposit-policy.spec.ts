import { DepositPolicy } from './deposit-policy';

describe('DepositPolicy', () => {
  it('from() acepta valores validos', () => {
    const policy = DepositPolicy.from({ applies: true, percentageOfTotal: 25 });
    expect(policy.applies).toBe(true);
    expect(policy.percentageOfTotal).toBe(25);
  });

  it('from() rechaza percentageOfTotal fuera de [0,100]', () => {
    expect(() => DepositPolicy.from({ applies: true, percentageOfTotal: 101 })).toThrow(TypeError);
    expect(() => DepositPolicy.from({ applies: true, percentageOfTotal: -1 })).toThrow(TypeError);
  });

  it('default() no aplica deposito', () => {
    const policy = DepositPolicy.default();
    expect(policy.applies).toBe(false);
    expect(policy.percentageOfTotal).toBe(0);
  });
});
