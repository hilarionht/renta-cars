import { Action } from './action';

describe('Action', () => {
  it('from() acepta la forma "Nombre.vN"', () => {
    expect(Action.from('CompanyRegistered.v1').toString()).toBe('CompanyRegistered.v1');
    expect(Action.from('BranchOpened.v12').toString()).toBe('BranchOpened.v12');
  });

  it('from() rechaza strings sin sufijo de version', () => {
    expect(() => Action.from('CompanyRegistered')).toThrow(TypeError);
  });

  it('from() rechaza strings con version no numerica', () => {
    expect(() => Action.from('CompanyRegistered.vX')).toThrow(TypeError);
  });

  it('from() rechaza strings vacios', () => {
    expect(() => Action.from('')).toThrow(TypeError);
  });
});
